import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
export const project = JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url))).projects.default
export const config = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url)))
const firestore = process.env.FIRESTORE_EMULATOR_HOST, auth = process.env.FIREBASE_AUTH_EMULATOR_HOST
assert.equal(firestore, '127.0.0.1:8080', 'Run with npm run test:emulators; loopback only')
assert.equal(auth, '127.0.0.1:9099', 'Auth emulator required')
assert.equal(process.env.GCLOUD_PROJECT, project, 'Same Firebase project ID required')
export const base = `http://${firestore}/v1/projects/${project}/databases/(default)/documents`
export const day = new Date(`${new Date(Date.now() + 28800000).toISOString().slice(0, 10)}T00:00:00Z`)
export const date = new Date('2020-01-01T00:00:00Z')
export const accounts = {}, tokens = {}, users = {}, profiles = {}
export let checks = 0
export function value(v) {
  if (v === null) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { integerValue: String(v) }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } }
}
export function write(path, data, serverFields = []) {
  // Fresh answer timestamps are server transforms, like the web transaction.
  if (path.includes('/answers/') && 'submittedAt' in data && !serverFields.includes('submittedAt')) serverFields = [...serverFields, 'submittedAt']
  const plain = { ...data }; for (const f of serverFields) delete plain[f]
  return { update: { name: `${base.slice(base.indexOf('/projects/') + 1)}/${path}`, fields: value(plain).mapValue.fields },
    ...(serverFields.length ? { updateTransforms: serverFields.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) } : {}) }
}
export function remove(path) { return { delete: `${base.slice(base.indexOf('/projects/') + 1)}/${path}` } }
export async function call(url, token, body, method = body ? 'POST' : 'GET') {
  assert.equal(new URL(url).hostname, '127.0.0.1', 'Never contact production')
  const r = await fetch(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { ok: r.ok, status: r.status, body: await r.json() }
}
export const commit = (token, writes) => call(`${base}:commit`, token, { writes })
export const get = (path, role) => call(`${base}/${path}`, tokens[role])
export async function ok(result) { const r = await result; assert(r.ok, JSON.stringify(r.body)); checks++; return r }
export async function denied(result) { const r = await result; assert.equal(r.status, 403, JSON.stringify(r.body)); checks++ }
export function user(uid, role, extra = {}) { return { uid, role, identifier: role === 'resident' ? 'R-2026-1000' : 'S-2026-1000', username: role === 'resident' ? '' : `fixture.${role}`, displayName: `Fixture ${role}`, isActive: true, isFirstLogin: false, profileCompleted: true, deletedAt: null, deletedByUid: null, deletedByName: '', deleteReason: '', createdAt: date, updatedAt: date, legacyId: null, ...extra } }
export const person = () => ({ courtesyTitle: '', firstName: 'Fixture', middleName: '', lastName: 'Person', nameExtension: '', gender: 'man' })
export const address = () => ({ householdNumber: '1', purok: '', streetHighway: '', barangay: 'Fixture', municipality: 'Fixture', postalCode: '', province: 'Fixture', displayLine: 'Fixture address' })
export const household = () => ({ occupation: '', hotlineNumber: '', isMarried: false, hasChildren: false, spouse: null, father: null, mother: null })
export function residentProfile(uid, extra = {}) { return { uid, name: person(), contact: { email: '', number: '' }, birthdate: new Date('2000-01-01T00:00:00Z'), birthplace: '', permanentAddress: address(), temporaryAddress: null, residencyStatus: 'permanent', residencyStartDate: date, residenceType: '', specialCategory: 'none', categoryReference: '', household: household(), lastResidencyRecordId: null, createdAt: date, updatedAt: date, legacyId: null, ...extra } }
export function staffProfile(uid) { return { uid, name: person(), position: '', dateHired: date, contact: { email: '', number: '' }, birthdate: null, licenseNumber: '', address: address(), emergencyContact: { name: '', number: '', legacyValue: '' }, createdByUid: accounts.admin, createdAt: date, updatedAt: date, legacyId: null } }
export function survey(extra = {}) { return { title: 'Fixture survey', description: '', startDate: day, endDate: day, status: 'active', createdByUid: accounts.staff, createdAt: date, updatedAt: date, legacyId: null, ...extra } }
export function answer(qid = 'rating', extra = {}) { return { questionId: qid, type: 'rating', questionText: 'Fixture rating', choiceId: null, choiceText: '', rating: 4, text: '', order: 1, legacyId: null, submittedAt: date, ...extra } }
export function response(uid, sid = 'open') { return { surveyId: sid, residentUid: uid, surveyTitle: 'Fixture survey', firstAnswerId: 'rating', submittedAt: date, legacyId: null } }
export function responseSchema(required = ['rating'], surveyVersion = date) {
  const ids = [...required].sort()
  return { surveyVersion, firstRequiredId: ids[0] || '', requiredNext: Object.fromEntries(ids.map((id, i) => [id, ids[i + 1] || ''])) }
}
export function proposal(extra = {}) { return { name: null, birthdate: new Date('1999-01-01T00:00:00Z'), permanentAddress: null, temporaryAddress: null, legacyEmail: '', legacyContact: '', legacyBarangaySubdivision: '', ...extra } }
export function request(kind, uid, proposed, extra = {}) { return { kind, ownerUid: uid, ownerIdentifier: Object.values(users).find(u => u.uid === uid)?.identifier || '', ownerDisplayName: Object.values(users).find(u => u.uid === uid)?.displayName || '', requestedByUid: uid, requestedByName: Object.values(users).find(u => u.uid === (extra.requestedByUid || uid))?.displayName || '', proposed, previousAddress: '', reason: 'Fixture correction', firstReferenceId: null, status: 'pending', requestedAt: date, reviewedAt: null, reviewedByUid: null, reviewedByName: '', reviewComment: '', legacyId: null, ...extra } }
export const pointer = (ownerUid, kind, requestId) => ({ ownerUid, kind, requestId })
export async function setup() {
  await ok(call(`http://${firestore}/emulator/v1/projects/${project}/databases/(default)/documents`, 'owner', null, 'DELETE'))
  for (const role of ['admin', 'staff', 'resident', 'other', 'first', 'onboarding', 'inactive', 'archived', 'unprovisioned']) {
    const credentials = { email: `${randomBytes(12).toString('hex')}@example.invalid`, password: `FixtureA1${randomBytes(16).toString('hex')}`, returnSecureToken: true }
    const signup = await ok(call(`http://${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, null, credentials))
    const login = await ok(call(`http://${auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`, null, credentials))
    assert.equal(signup.body.localId, login.body.localId)
    accounts[role] = signup.body.localId; tokens[role] = login.body.idToken
  }
  const writes = []
  for (const role of Object.keys(accounts).filter(r => r !== 'unprovisioned')) {
    const kind = ['admin', 'staff', 'onboarding'].includes(role) ? (role === 'admin' ? 'admin' : 'staff') : 'resident'
    const extra = role === 'first' ? { isFirstLogin: true } : role === 'onboarding' ? { isFirstLogin: true, profileCompleted: false }
      : role === 'inactive' ? { isActive: false } : role === 'archived' ? { deletedAt: date, deletedByUid: accounts.admin, deletedByName: 'Fixture admin', deleteReason: 'Fixture archive' } : {}
    users[role] = user(accounts[role], kind, extra); profiles[role] = kind === 'resident' ? residentProfile(accounts[role]) : staffProfile(accounts[role])
    writes.push(write(`users/${accounts[role]}`, users[role]), write(`${kind === 'resident' ? 'residents' : 'staff'}/${accounts[role]}`, profiles[role]))
  }
  for (const [sid, data] of Object.entries({ open: survey(), past: survey({ startDate: new Date(day.getTime() - 86400000), endDate: new Date(day.getTime() - 86400000) }), future: survey({ startDate: new Date(day.getTime() + 86400000), endDate: new Date(day.getTime() + 86400000) }), inactive: survey({ status: 'inactive' }) })) writes.push(write(`surveys/${sid}`, data), write(`surveys/${sid}/questions/rating`, { text: 'Fixture rating', type: 'rating', order: 1, legacyId: null }))
  for (const name of ['residentNumbers', 'staffNumbers']) writes.push(write(`counters/${name}`, { value: 0, lastUid: null, updatedAt: date }))
  writes.push(write('identifierAliases/private', { uid: accounts.admin }), write('loginHistory/trusted', { actorUid: accounts.admin }))
  for (const sid of ['open', 'past', 'future', 'inactive']) writes.push(write(`surveys/${sid}/validation/response`, responseSchema()))
  await ok(commit('owner', writes))
}
