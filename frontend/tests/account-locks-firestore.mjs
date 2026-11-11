/** Exclusive-slot emulator test. Never uploads rules, resets data, reads credentials or uses production. */
import assert from 'node:assert/strict'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { initializeApp as initializeClient, deleteApp as deleteClient } from 'firebase/app'
import { connectAuthEmulator, getAuth as clientAuth, signInWithEmailAndPassword, inMemoryPersistence, setPersistence } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore as clientStore, getDocFromServer, doc, updateDoc, deleteDoc, serverTimestamp, terminate } from 'firebase/firestore'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
const { user, residentProfile, staffProfile, survey, response, day } = await import('./firestore-fixtures.mjs')
const require = createRequire(new URL('../../migration/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const admin = initializeApp({ projectId: project }, 'account-locks-test'), db = getFirestore(admin), auth = getAuth(admin)
const tag = `locks-${randomUUID().slice(0, 12)}`, password = 'FixturePass8', replacement = 'ReplacementPass9'
const sid = `${tag}-survey`, roles = ['resident', 'staff', 'admin'], fixtures = new Set(), identities = [], clients = {}, tokens = {}, aliases = {}
const origin = 'http://127.0.0.1:8787/api/firebase/'
let dev, checks = 0
// Assertions deliberately omit data values: migrated personal information never enters evidence.
const check = (condition, label) => { assert(condition, label); checks++ }
const equal = (a, b, label) => check(isDeepStrictEqual(a, b), label)
async function snapshot() {
  const result = new Map()
  async function walk(parent) { for (const collection of await parent.listCollections()) for (const ref of await collection.listDocuments()) {
    const data = await ref.get(); if (data.exists) result.set(ref.path, data.data()); await walk(ref)
  } }
  await walk(db); return result
}
async function authIds() { const result = []; let pageToken; do { const page = await auth.listUsers(1000, pageToken); result.push(...page.users.map(u => u.uid)); pageToken = page.pageToken } while (pageToken); return result.sort() }
async function seed(path, data) { await db.doc(path).create(data); fixtures.add(path) }
async function api(file, action, values = {}, role = 'resident') {
  const url = origin + file + (file === 'index.php' ? `?action=${action}` : '')
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, ...(file === 'index.php' ? {} : { action }), idToken: tokens[role] }) })
  return { status: r.status, body: await r.json() }
}
async function allowed(promise, label) { const result = await promise; check(result.status === 200 && result.body.ok, label); return result.body }
async function forbidden(promise, label) { const result = await promise; check(result.status === 403 && !result.body.ok && result.body.message === 'Access denied.', label) }
async function sdkDenied(promise, label) {
  let code; try { await promise } catch (error) { code = error.code }
  check(code === 'permission-denied', label)
}
async function ready() { for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + 'index.php?action=rules')).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 100)) } throw new Error('Local account-lock test API unavailable') }
async function credentialWorks(role, candidate) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${tag}-${role}@example.invalid`, password: candidate, returnSecureToken: true }) })
  return r.ok
}
async function roleRead(role) {
  if (role === 'resident') {
    await allowed(api('resident-profile.php', 'get'), 'Unlocked resident profile API read')
    await allowed(api('resident-read.php', 'history'), 'Unlocked resident history API read')
    await allowed(api('survey-schema.php', '', { surveyId: sid }), 'Unlocked resident schema preparation')
  } else {
    await allowed(api('staff-surveys.php', 'get', { id: sid }, role), `Unlocked ${role} survey API read`)
    await allowed(api('staff-reports.php', 'results', { survey_id: sid }, role), `Unlocked ${role} report API read`)
  }
}
async function protectedSdkWrite(role, marker) {
  const store = clients[role].store
  if (role === 'resident') return updateDoc(doc(store, 'residents', `${tag}-resident`), { contact: { email: `${marker}@example.invalid`, number: '' }, updatedAt: serverTimestamp() })
  return updateDoc(doc(store, 'surveys', sid), { description: marker, updatedAt: serverTimestamp() })
}
const original = await snapshot(), originalAuth = await authIds()
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Shared local emulators available')
  for (const role of roles) {
    const uid = `${tag}-${role}`, email = `${uid}@example.invalid`
    await auth.createUser({ uid, email, password }); identities.push(uid)
    const identifier = role === 'resident' ? `R-${randomInt(1000, 10000)}-${randomInt(1000, 10000)}` : `${tag}-${role}`
    const kind = role === 'resident' ? 'residentNumber' : 'username', normalizedIdentifier = identifier.toLowerCase()
    aliases[role] = identifier
    await seed(`users/${uid}`, user(uid, role, { identifier: role === 'resident' ? identifier : `S-${randomInt(1000, 10000)}-${randomInt(1000, 10000)}`, username: role === 'resident' ? '' : identifier }))
    await seed(`${role === 'resident' ? 'residents' : 'staff'}/${uid}`, role === 'resident' ? residentProfile(uid) : { ...staffProfile(uid), createdByUid: `${tag}-admin` })
    await seed(`identifierAliases/${kind}_${createHash('sha256').update(normalizedIdentifier).digest('hex')}`, { kind, normalizedIdentifier, uid, authEmail: email, createdAt: day })
    const app = initializeClient({ apiKey: 'emulator-only', projectId: project, authDomain: `${project}.firebaseapp.com` }, `${tag}-${role}`)
    const identity = clientAuth(app), store = clientStore(app)
    connectAuthEmulator(identity, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(store, '127.0.0.1', 8080)
    await setPersistence(identity, inMemoryPersistence)
    clients[role] = { app, identity, store }
    await signInWithEmailAndPassword(identity, email, password); tokens[role] = await identity.currentUser.getIdToken()
  }
  await seed(`surveys/${sid}`, survey({ createdByUid: `${tag}-staff`, description: 'Original synthetic description' }))
  await seed(`surveys/${sid}/questions/rating`, { text: 'Rate the synthetic visit', type: 'rating', order: 1, legacyId: null })
  await seed(`responses/${sid}_${tag}-resident`, response(`${tag}-resident`, sid))
  dev = startAuthDev(); await ready()
  for (const role of roles) {
    console.log(`Checking ${role} lock refusal and recovery`)
    const uid = `${tag}-${role}`, lock = `accountLocks/${uid}`, profilePath = `${role === 'resident' ? 'residents' : 'staff'}/${uid}`, store = clients[role].store
    await allowed(api('index.php', 'resolve', { identifier: aliases[role], password }, role), `Unlocked ${role} alias resolution`)
    await allowed(api('index.php', 'profile', {}, role), `Unlocked ${role} verified header`)
    await roleRead(role)
    check((await getDocFromServer(doc(store, profilePath))).exists(), `Unlocked ${role} protected SDK profile read`)
    check((await getDocFromServer(doc(store, 'surveys', sid))).exists(), `Unlocked ${role} SDK survey read`)
    if (role === 'resident') { await protectedSdkWrite(role, 'before-lock'); checks++ }
    else await sdkDenied(protectedSdkWrite(role, 'before-lock'), `${role} administrative SDK writes remain server-only`)
    const beforeProfile = (await db.doc(profilePath).get()).data(), beforeUser = (await db.doc(`users/${uid}`).get()).data(), beforeSurvey = (await db.doc(`surveys/${sid}`).get()).data()
    const fixtureBefore = await snapshot()
    await seed(lock, { uid, operationId: randomUUID(), kind: 'synthetic-actor-lock', createdAt: day })
    for (const action of ['profile', 'login', 'logout']) await forbidden(api('index.php', action, { operationId: randomUUID() }, role), `Locked ${role} refuses verified ${action}`)
    await forbidden(api('index.php', 'resolve', { identifier: aliases[role], password }, role), `Locked ${role} refuses alias login`)
    await forbidden(api('index.php', 'password', { current_password: password, new_password: replacement, confirm_password: replacement }, role), `Locked ${role} refuses actual password change`)
    if (role === 'resident') {
      for (const action of ['get', 'contact', 'removePhoto', 'birthdate', 'nameAddress', 'family']) await forbidden(api('resident-profile.php', action, { email: 'blocked@example.invalid', contact_number: '' }), `Locked resident refuses profile ${action}`)
      for (const action of ['history', 'response', 'submitted']) await forbidden(api('resident-read.php', action, { responseId: `${sid}_${uid}`, surveyId: sid }), `Locked resident refuses metadata ${action}`)
      await forbidden(api('survey-schema.php', '', { surveyId: sid }), 'Locked resident refuses trusted schema preparation')
      await sdkDenied(getDocFromServer(doc(store, 'responses', `${sid}_${uid}`)), 'Locked resident refuses own response SDK read')
    } else {
      for (const action of ['list', 'get', 'toggle', 'update', 'delete', 'questions', 'questionCreate', 'questionUpdate', 'questionDelete', 'questionMove']) await forbidden(api('staff-surveys.php', action, { id: sid, survey_id: sid, question_id: 'rating', question_text: 'Blocked question' }, role), `Locked ${role} refuses survey ${action}`)
      for (const action of ['dashboard', 'detail', 'trend', 'results', 'report', 'csv']) await forbidden(api('staff-reports.php', action, { survey_id: sid, view: role === 'admin' ? 'recent_logins' : 'total_surveys' }, role), `Locked ${role} refuses report ${action}`)
      await forbidden(api('accounts.php', 'resetResident', { targetUid: `${tag}-resident`, operationId: randomUUID() }, role), `Locked ${role} refuses privileged Auth reset`)
      await sdkDenied(getDocFromServer(doc(store, 'users', `${tag}-resident`)), `Locked ${role} refuses cross-user SDK read`)
    }
    await sdkDenied(getDocFromServer(doc(store, profilePath)), `Locked ${role} refuses protected SDK profile read`)
    await sdkDenied(getDocFromServer(doc(store, 'surveys', sid)), `Locked ${role} refuses SDK survey read`)
    await sdkDenied(protectedSdkWrite(role, 'blocked-update'), `Locked ${role} refuses otherwise-valid SDK write`)
    await sdkDenied(deleteDoc(doc(store, lock)), `Locked ${role} cannot remove its own lock`)
    check((await getDocFromServer(doc(store, 'users', uid))).exists(), `Locked ${role} can still read own lifecycle document`)
    equal((await db.doc(profilePath).get()).data(), beforeProfile, `Locked ${role} profile unchanged`)
    equal((await db.doc(`users/${uid}`).get()).data(), beforeUser, `Locked ${role} lifecycle flags unchanged`)
    equal((await db.doc(`surveys/${sid}`).get()).data(), beforeSurvey, `Locked ${role} survey data unchanged`)
    const lockedState = await snapshot(); lockedState.delete(lock)
    equal(lockedState, fixtureBefore, `Locked ${role} refusals create no audit/request/metadata or other writes`)
    check(await credentialWorks(role, password), `Locked ${role} original Auth password still works`)
    check(!await credentialWorks(role, replacement), `Locked ${role} rejected password was never applied`)
    check(await credentialWorks('resident', password), `Locked ${role} privileged reset did not change resident password`)
    await db.doc(lock).delete()
    await allowed(api('index.php', 'resolve', { identifier: aliases[role], password }, role), `Unlock restores ${role} alias login`)
    await allowed(api('index.php', 'profile', {}, role), `Unlock restores ${role} verified header`)
    await roleRead(role)
    check((await getDocFromServer(doc(store, profilePath))).exists(), `Unlock restores ${role} SDK profile read using same session`)
    if (role === 'resident') { await protectedSdkWrite(role, 'after-unlock'); checks++ }
    else await sdkDenied(protectedSdkWrite(role, 'after-unlock'), `${role} administrative SDK writes remain server-only`)
    if (role === 'resident') await allowed(api('resident-profile.php', 'contact', { email: 'restored@example.invalid', contact_number: '' }), 'Unlock restores resident trusted mutation')
    else {
      await allowed(api('staff-surveys.php', 'toggle', { id: sid }, role), `Unlock restores ${role} trusted mutation`)
      await allowed(api('staff-surveys.php', 'toggle', { id: sid }, role), `Restore synthetic survey open state after ${role} toggle`)
    }
  }
  // Password success after unlock is tested last, so earlier reset-refusal evidence uses unchanged credentials.
  for (const role of roles) {
    await allowed(api('index.php', 'password', { current_password: password, new_password: replacement, confirm_password: replacement }, role), `Unlock restores ${role} password mutation`)
    check(await credentialWorks(role, replacement), `Unlocked ${role} password actually changes in Auth`)
    check(!await credentialWorks(role, password), `Unlocked ${role} old password no longer authenticates`)
  }
} finally {
  dev?.stop()
  for (const client of Object.values(clients)) { await terminate(client.store); await deleteClient(client.app) }
  const current = await snapshot()
  const cleanup = [...current.entries()].filter(([path, data]) => fixtures.has(path) || path.includes(tag) || data.actorUid?.startsWith(tag)).map(([path]) => path)
  for (let i = 0; i < cleanup.length; i += 400) { const batch = db.batch(); cleanup.slice(i, i + 400).forEach(path => batch.delete(db.doc(path))); await batch.commit() }
  for (const uid of identities) await auth.deleteUser(uid)
  equal(await snapshot(), original, 'Every original emulator document and counter remains unchanged')
  equal(await authIds(), originalAuth, 'Every original Auth identity remains unchanged')
  await db.terminate(); await deleteApp(admin)
}
console.log(`PASS: ${checks} account-lock API/SDK checks; preserved ${original.size} original documents and ${originalAuth.length} Auth identities.`)
