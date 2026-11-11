import { HttpError } from './core/errors.mjs'
import { profileStrings } from './policy.mjs'
export const apiError = (message, status = 422) => { throw new HttpError(message, status) }
export function accountStrings(input, keys) {
  try { return profileStrings(input, keys) }
  catch (error) { if (error instanceof HttpError) apiError(error.message, 422); throw error }
}
export function accountId(value) {
  if ((typeof value !== 'string' && !Number.isInteger(value)) || !/^[A-Za-z0-9_-]{1,128}$/.test(String(value))) apiError('Invalid request.')
  return String(value)
}
export function operationId(input) {
  const id = input.operationId
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) apiError('Invalid request.')
  return id.toLowerCase()
}
export const randomId = () => crypto.randomUUID().replaceAll('-', '')
export async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('')
}
// Preserve PHP json_encode fingerprints on retries across the conversion.
export function phpJson(value, unicode = false) {
  let json = JSON.stringify(value).replaceAll('/', '\\/')
  if (!unicode) json = json.replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
  return json
}
export function bounds(data) {
  const limits = { email:100, number:20, courtesyTitle:20, firstName:50, middleName:50, lastName:50, nameExtension:20, gender:20, occupation:100, hotlineNumber:30, displayLine:255, previousAddress:255, reason:255, reviewComment:255, householdNumber:50, purok:100, streetHighway:150, barangay:100, municipality:100, postalCode:10, province:100, licenseNumber:50, legacyValue:150 }
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !(value instanceof Date)) bounds(value)
    else if (typeof value === 'string' && limits[key] && Array.from(value).length > limits[key]) apiError('The request could not be completed. Please try again.')
  }
}
export function write(ctx, path, data, merge = false, serverTimes = []) {
  bounds(data)
  return ctx.store.write(path, data, { ...(merge ? { mask: Object.keys(data) } : {}), serverTimes })
}
export const result = (message = '', data = [], extra = {}) => ({ ok: true, data, message, ...extra })
export function admin(account) { if (account?.role !== 'admin') apiError('Access denied.', 403) }
export async function query(ctx, parent, collectionId, tx = null, filter = [], limit = 0) {
  const rows = await ctx.store.query({ parent, collectionId, ...(filter.length ? { where: [{ field: filter[0], op: 'EQUAL', value: filter[1] }] } : {}), ...(limit ? { limit } : {}) }, tx)
  return rows.map(row => ({ id: row.id, ...row.data }))
}
export async function filterQuery(ctx, parent, collectionId, filters = {}, tx = null) {
  const rows = await ctx.store.query({ parent, collectionId, where: Object.entries(filters).map(([field, value]) => ({ field, op: 'EQUAL', value })) }, tx)
  return rows.map(row => ({ id: row.id, ...row.data }))
}
export async function unlocked(ctx, uid, tx) {
  if (await ctx.store.get('accountLocks/' + uid, tx)) apiError('The request could not be completed. Please try again.', 409)
}
export async function accountTransaction(ctx, actor, work, onboarding = false) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const tx = await ctx.store.begin()
    try {
      let account = null
      if (actor) {
        account = await ctx.store.get('users/' + actor, tx)
        if (!account || account.deletedAt != null || !account.isActive) apiError('Access denied.', 403)
        await unlocked(ctx, actor, tx)
        if (!['staff', 'admin'].includes(account.role) || account.isFirstLogin || (!onboarding && !account.profileCompleted)) apiError('Access denied.', 403)
      }
      const [writes, data] = await work(tx, account)
      if (writes.length > 500) apiError('The request could not be completed. Please try again.')
      if (!writes.length) { await ctx.store.rollback(tx); return data }
      const response = await ctx.store.commit(writes, tx)
      if (response.status === 409) { await ctx.store.rollback(tx); continue }
      if (response.status !== 200) throw new Error('Commit unavailable')
      return data
    } catch (error) {
      await ctx.store.rollback(tx).catch(() => {})
      if (error.retry && attempt < 7) continue
      throw error
    }
  }
  throw new Error('Concurrent edit; retry')
}
export async function once(ctx, actor, input, work) {
  const op = operationId(input), path = 'accountOperations/' + await hash(actor + ':' + op)
  const binding = { ...input }; delete binding.idToken; delete binding.operationId
  const fingerprint = await hash(phpJson(binding))
  return accountTransaction(ctx, actor, async (tx, account) => {
    const old = await ctx.store.get(path, tx)
    if (old) { if (old.fingerprint !== fingerprint) apiError('Invalid request.'); return [[], old.result] }
    const [writes, output] = await work(tx, account)
    writes.push(write(ctx, path, { fingerprint, result: output, state: 'complete' }, false, ['createdAt', 'updatedAt']))
    return [writes, output]
  })
}
export async function peopleWrites(ctx, parent, groups, tx = null) {
  const writes = []
  const { profileMap, PROFILE_PERSON } = await import('./policy.mjs')
  for (const [collection, rows] of Object.entries(groups)) {
    if (tx) for (const old of await query(ctx, parent, collection, tx)) {
      const match = old.id.match(/^person-(\d+)$/)
      if (!match || Number(match[1]) >= rows.length) writes.push(ctx.store.remove(parent + '/' + collection + '/' + old.id))
    }
    for (const [index, row] of rows.entries()) writes.push(write(ctx, parent + '/' + collection + '/person-' + index, { person: 'firstName' in row ? row : profileMap(row, PROFILE_PERSON), displayOrder: index, legacyId: null }, false, ['createdAt']))
  }
  return writes
}
