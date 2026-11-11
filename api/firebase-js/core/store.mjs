import { HttpError } from './errors.mjs'
import { jsonRequest, googleToken } from './google.mjs'
export function decode(value) {
  if ('nullValue' in value) return null
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, v]) => [key, decode(v)]))
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode)
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  return value.stringValue ?? value.booleanValue ?? value.referenceValue ?? null
}
export function encode(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)])) } }
}
export function createStore(env, project = 'barangay-survey-1cc7d') {
  const local = env.BSS_USE_EMULATORS === 'true'
  if (project !== 'barangay-survey-1cc7d' || (local && env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')) throw new HttpError('Server configuration unavailable.', 503)
  const resource = `projects/${project}/databases/(default)/documents`
  const base = (local ? 'http://127.0.0.1:8080/v1/' : 'https://firestore.googleapis.com/v1/') + resource
  const name = path => `${resource}/${path.replace(/^\/+|\/+$/g, '')}`
  const document = row => ({ id: row.name.split('/').pop(), path: row.name.slice(resource.length + 1), data: Object.fromEntries(Object.entries(row.fields || {}).map(([k, v]) => [k, decode(v)])) })
  const request = async (suffix, body = null, method) => jsonRequest(base + suffix, body, await googleToken(env), method)
  function ensure(result) {
    if (result.status === 409 || result.body?.error?.status === 'ABORTED') throw Object.assign(new HttpError('Concurrent edit; retry.', 409), { retry: true })
    if (result.status !== 200) throw new HttpError('The system is temporarily unavailable. Please try again in a few minutes.', 503)
    return result.body
  }
  const store = {
    name, encode, decode, request,
    async get(path, tx = null) {
      if (tx) return (await store.batchGet([path], tx)).get(path)
      const result = await request('/' + path.split('/').map(encodeURIComponent).join('/'))
      if (result.status === 404) return null
      return document(ensure(result)).data
    },
    async batchGet(paths, tx = null) {
      const out = new Map(paths.map(path => [path, null]))
      if (!paths.length) return out
      const rows = ensure(await request(':batchGet', { documents: paths.map(name), ...(tx ? { transaction: tx } : {}) }))
      for (const row of rows) if (row.found) { const data = document(row.found); out.set(data.path, data.data) }
      return out
    },
    async list(path, options = {}) {
      if (options.tx || options.orderBy || options.limit) {
        const parts = path.split('/'), collectionId = parts.pop()
        return store.query({ collectionId, parent: parts.join('/'), orderBy: options.orderBy, limit: options.limit }, options.tx)
      }
      let pageToken, rows = []
      do {
        const query = new URLSearchParams({ pageSize: '300', ...(pageToken ? { pageToken } : {}) })
        const body = ensure(await request('/' + path.split('/').map(encodeURIComponent).join('/') + '?' + query))
        rows.push(...(body.documents || []).map(document)); pageToken = body.nextPageToken
      } while (pageToken)
      return rows
    },
    async query(spec, tx = null) {
      const query = { from: [{ collectionId: spec.collectionId, allDescendants: Boolean(spec.allDescendants) }] }
      if (spec.select?.length) query.select = { fields: spec.select.map(fieldPath => ({ fieldPath })) }
      if (spec.where?.length) {
        const filters = spec.where.map(({ field, op = 'EQUAL', value }) => ({ fieldFilter: { field: { fieldPath: field }, op, value: encode(value) } }))
        query.where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } }
      }
      if (spec.orderBy?.length) query.orderBy = spec.orderBy.map(({ field, direction = 'ASCENDING' }) => ({ field: { fieldPath: field }, direction }))
      if (spec.limit) query.limit = spec.limit
      const rows = ensure(await request((spec.parent ? '/' + spec.parent : '') + ':runQuery', { structuredQuery: query, ...(tx ? { transaction: tx } : {}) }))
      return rows.filter(row => row.document).map(row => document(row.document))
    },
    async begin(readOnly = false) {
      const body = ensure(await request(':beginTransaction', { options: { [readOnly ? 'readOnly' : 'readWrite']: {} } }))
      return body.transaction
    },
    async rollback(transaction) { if (transaction) await request(':rollback', { transaction }) },
    async commit(writes, transaction = null) {
      if (writes.length > 500) throw new HttpError('The request could not be completed. Please try again.', 422)
      return request(':commit', { writes, ...(transaction ? { transaction } : {}) })
    },
    write(path, data, options = {}) {
      return { update: { name: name(path), fields: encode(data).mapValue.fields },
        ...(options.mask ? { updateMask: { fieldPaths: options.mask } } : {}),
        ...(typeof options.exists === 'boolean' ? { currentDocument: { exists: options.exists } } : {}),
        ...(options.serverTimes?.length ? { updateTransforms: options.serverTimes.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) } : {}) }
    },
    remove(path, options = {}) { return { delete: name(path), ...(typeof options.exists === 'boolean' ? { currentDocument: { exists: options.exists } } : {}) } },
    async transaction(work) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const tx = await store.begin()
        try {
          const { writes, result } = await work(tx)
          if (!writes.length) { await store.rollback(tx); return result }
          ensure(await store.commit(writes, tx)); return result
        } catch (error) {
          await store.rollback(tx)
          if (error.retry && attempt < 7) continue
          throw error
        }
      }
    },
  }
  return store
}
