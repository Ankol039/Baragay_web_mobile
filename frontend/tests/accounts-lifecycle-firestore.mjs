import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'
import { preserveAccounts } from './accounts-preserve.mjs'
Object.assign(process.env, emulatorEnv)
const { base, call, user, residentProfile, staffProfile, person, request, proposal, household } = await import('./firestore-fixtures.mjs')
const require = createRequire(new URL('../../migration/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const admin = initializeApp({ projectId: project }, 'accounts-lifecycle-test'), db = getFirestore(admin), auth = getAuth(admin)
const tag = 'accounts-life-' + randomUUID().slice(0, 8), ids = {}, tokens = {}, password = 'FixturePass8'
const origin = 'http://127.0.0.1:5173/barangay_survey_system/app/', endpoint = 'http://127.0.0.1:8787/api/firebase/accounts.php'
let browser, dev, checks = 0
const diagnostics = []
const check = (value, label) => { assert(value, label); checks++ }
const put = async (path, data, merge = false) => db.doc(path).set(data, { merge })
const get = async path => (await db.doc(path).get()).data()
async function api(action, data = {}, role = 'admin', op = randomUUID()) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data, operationId: op, idToken: tokens[role] || '' }) })
  return { status: r.status, ...await r.json() }
}
async function ready(url) { for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) return } catch {} await new Promise(r => setTimeout(r, 100)) } throw new Error('Server start') }
const defaults = { first_name: 'Resident', middle_name: 'Synthetic', last_name: 'Account', gender: 'woman', birthdate: '2000-01-01', birthplace: 'Test Town', residency_status: 'temporary', residency_start_date: '2020-01-01', residence_type: 'AR', household_number: '1', barangay: 'Original', municipality: 'Test City', province: 'Test Province', postal_code: '1234', temp_household_number: '2', temp_barangay: 'Living', temp_municipality: 'Test City', temp_province: 'Test Province', temp_postal_code: '1234', references: [{ first_name: 'Reference', last_name: 'Person', gender: 'man' }] }
async function signedPage(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Production request'); return route.abort() })
  await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/firebase/'), route => { diagnostics.push('Legacy API request'); return route.abort() })
  const page = await context.newPage(); page.on('pageerror', e => diagnostics.push(e.message))
  await page.goto(origin + 'login')
  await page.evaluate(async ({ email, password }) => {
    const { getFirebase } = await import('/barangay_survey_system/app/src/services/firebase.js')
    const { signInWithEmailAndPassword } = await import('/barangay_survey_system/app/node_modules/.vite/deps/firebase_auth.js')
    await signInWithEmailAndPassword(getFirebase().auth, email, password)
  }, { email: `${ids[role]}@example.invalid`, password })
  return page
}
async function service(page, method, args = []) { return page.evaluate(async ({ method, args }) => { try { return await (await import('/barangay_survey_system/app/src/services/accountsService.js'))[method](...args) } catch (e) { return { error: e.message } } }, { method, args }) }
check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Existing emulators running')
const before = await preserveAccounts(db, auth, base, call)
try {
  for (const role of ['admin', 'staff', 'resident', 'first', 'onboarding', 'inactive', 'archived']) {
    const uid = ids[role] = `${tag}-${role}`, kind = role === 'admin' ? 'admin' : role === 'resident' ? 'resident' : 'staff'
    await auth.createUser({ uid, email: `${uid}@example.invalid`, password })
    await put('users/' + uid, user(uid, kind, role === 'first' ? { isFirstLogin: true } : role === 'onboarding' ? { profileCompleted: false } : role === 'inactive' ? { isActive: false } : role === 'archived' ? { deletedAt: new Date() } : {}))
    await put((kind === 'resident' ? 'residents/' : 'staff/') + uid, kind === 'resident' ? residentProfile(uid) : { ...staffProfile(uid), createdByUid: null })
    tokens[role] = (await call('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', null, { email: `${uid}@example.invalid`, password, returnSecureToken: true })).body.idToken
  }
  dev = startAuthDev(); await ready(origin)
  // Accounts endpoint requires POST; use the always-public metadata for readiness.
  for (let i = 0; i < 30; i++) { try { if ((await api('registrationFields')).ok) break } catch {} await new Promise(r => setTimeout(r, 100)) }
  for (const role of ['resident', 'first', 'onboarding', 'inactive', 'archived']) check(!(await api('residents', {}, role)).ok, `${role} management gate`)
  const created = await api('createResident', { values: defaults }, 'staff'); check(created.ok, 'Staff creates resident: ' + created.message)
  const uid = created.data.uid, number = created.data.resident_number
  check((await api('residents', {}, 'staff')).data.residents.some(r => r.resident_id === uid && r.residency_status === 'temporary' && r.is_first_login), 'Resident list typed fields')
  let detail = (await api('resident', { id: uid }, 'staff')).data.resident
  check(detail.references[0].first_name === 'Reference' && detail.temp_household_number === '2', 'Full resident/family/address detail')
  const edited = { ...defaults, resident_id: uid, first_name: 'Edited', occupation: 'Nurse', is_married: '1', spouse_first_name: 'Spouse', spouse_last_name: 'Person', has_children: '1', children: [{ first_name: 'Child', last_name: 'Person' }] }
  check((await api('updateResident', { resident_id: uid, values: edited }, 'staff')).ok, 'Full resident edit')
  detail = (await api('resident', { id: uid })).data.resident
  check(detail.first_name === 'Edited' && detail.children.length === 1 && detail.spouse_first_name === 'Spouse', 'Family edit persists ordered people')
  check((await api('updateResident', { resident_id: uid, values: { ...edited, residency_status: 'permanent' } }, 'staff')).ok && (await get('residents/' + uid)).residencyStatus === 'temporary', 'Edit cannot silently change residency status')
  check(!(await api('promote', { resident_id: uid }, 'staff')).ok, 'Staff cannot promote')
  const promoted = await api('promote', { resident_id: uid, reason: 'Stayed six months' }); check(promoted.ok, 'Eligible promotion')
  check((await get('residents/' + uid)).permanentAddress.householdNumber === '2' && (await get('residents/' + uid)).temporaryAddress === null, 'Promotion moves temporary address and clears temporary section')
  check((await api('resident', { id: uid })).data.restore_address.includes('Original'), 'Archived permanent address available')
  check(!(await api('revert', { resident_id: uid, reason: '' })).ok, 'Reversion requires reason')
  check((await api('revert', { resident_id: uid, reason: 'Correction' })).ok, 'Admin reversion')
  check((await get('residents/' + uid)).permanentAddress.householdNumber === '1' && (await get('residents/' + uid)).temporaryAddress.householdNumber === '2' && (await get('residents/' + uid)).residenceType === 'AR', 'Reversion restores original permanent and current living address')
  check((await api('residencyRecords')).data.changes.some(r => r.resident_id === uid && r.to_status === 'temporary'), 'Residency history visible')
  check(!(await api('residencyRecords', {}, 'staff')).ok, 'History admin-only')
  await put('residents/' + uid, { residencyStartDate: new Date() }, true)
  check(!(await api('promote', { resident_id: uid })).ok, 'Minimum residency eligibility enforced')
  await put('residents/' + uid, { residencyStartDate: new Date('2020-01-01') }, true)
  const reqid = `${tag}-birthdate`; await put('nameAddressRequests/' + reqid, request('nameAddress', uid, proposal(), { ownerIdentifier: number, ownerDisplayName: 'Edited Account' }))
  const oldAddress = (await get('residents/' + uid)).permanentAddress
  const decisions = await Promise.all([api('review', { kind: 'resident', request_id: reqid, decision: 'approve', review_comment: '' }, 'staff'), api('review', { kind: 'resident', request_id: reqid, decision: 'reject', review_comment: '' }, 'staff')])
  check(decisions.filter(r => r.ok).length === 1, 'Competing reviews decide once')
  check((await get('residents/' + uid)).permanentAddress.displayLine === oldAddress.displayLine, 'Birthdate-only review preserves address')
  const familyid = `${tag}-family`; await put('familyRequests/' + familyid, request('family', uid, { ...household(), occupation: 'Teacher' }, { ownerIdentifier: number }))
  await put('familyRequests/' + familyid + '/characterReferences/1', { person: { ...person(), firstName: 'New Reference' }, displayOrder: 0, legacyId: null })
  await put('pendingRequests/' + uid + '_family', { ownerUid: uid, kind: 'family', requestId: familyid })
  check((await api('requests')).data.family.some(r => r.request_id === familyid && r.details.some(v => v[1].includes('Teacher'))), 'Family request details serialize')
  check((await api('review', { kind: 'family', request_id: familyid, decision: 'approve', review_comment: 'Verified' })).ok, 'Family approval')
  check((await get('residents/' + uid)).household.occupation === 'Teacher' && !(await get('pendingRequests/' + uid + '_family')), 'Family fields applied and pending slot cleared')
  check((await db.collection('residents/' + uid + '/children').get()).empty, 'Approved empty children replaces previous children')
  const rejected = `${tag}-reject`; await put('nameAddressRequests/' + rejected, request('nameAddress', uid, proposal(), { ownerIdentifier: number }))
  check((await api('review', { kind: 'resident', request_id: rejected, decision: 'reject', review_comment: 'Not supported' })).ok, 'Resident rejection')
  check((await get('nameAddressRequests/' + rejected)).reviewComment === 'Not supported', 'Review comment persists')
  const staffData = { contact_number: '09123456789', email: 'test@example.invalid', birthdate: '1990-01-01', gender: 'woman', license_number: 'PRC-123', emergency_contact_name: 'Emergency Person', emergency_contact_number: '09987654321', household_number: '4', barangay: 'Staff Barangay', municipality: 'Staff City', province: 'Staff Province', postal_code: '1234' }
  check((await api('staffProfile', {}, 'onboarding')).data.onboarding, 'Staff onboarding accessible')
  check((await api('staffSave', { ...staffData, contact_number: '' }, 'onboarding')).message === 'Contact number is required.', 'Original staff contact validation')
  check((await api('staffSave', staffData, 'onboarding')).outcome === 'first', 'Onboarding records address directly')
  check((await get('users/' + ids.onboarding)).profileCompleted && (await get('staff/' + ids.onboarding)).emergencyContact.name === 'Emergency Person', 'Onboarding flag and emergency contact persist')
  check(!(await api('staffSave', staffData)).ok, 'Admin profile fields remain read-only')
  check((await api('staffSave', { ...staffData, household_number: '5', reason: 'Moved' }, 'onboarding')).outcome === 'requested', 'Later staff address creates request')
  check((await get('staff/' + ids.onboarding)).address.householdNumber === '4', 'Staff proposed address remains under review')
  const sq = (await db.collection('staffRequests').where('ownerUid', '==', ids.onboarding).get()).docs[0].id
  check(!(await api('review', { kind: 'staff', request_id: sq, decision: 'approve' }, 'staff')).ok, 'Staff cannot review staff requests')
  check((await api('review', { kind: 'staff', request_id: sq, decision: 'reject', review_comment: '' })).message === 'Give a short reason when rejecting a request.', 'Staff rejection reason required')
  check((await api('review', { kind: 'staff', request_id: sq, decision: 'approve', review_comment: 'Checked' })).ok, 'Admin approves staff address')
  check((await get('staff/' + ids.onboarding)).address.householdNumber === '5', 'Staff address application uses migrated flat schema')
  check(!(await api('staffPhoto', { photo: 'invalid' }, 'staff')).ok, 'Staff photo validation')
  const lockPath = 'accountLocks/' + uid; await put(lockPath, { operationPath: 'accountOperations/other' })
  check((await api('toggle', { targetUid: uid })).status === 409, 'Lifecycle honors reset lock')
  check((await api('updateResident', { resident_id: uid, values: edited })).status === 409, 'Resident edit honors reset lock')
  await db.doc(lockPath).delete(); await put('accountLocks/' + ids.staff, { operationPath: 'accountOperations/other' })
  check([403,409].includes((await api('residents', {}, 'staff')).status), 'Actor lock enforced')
  await db.doc('accountLocks/' + ids.staff).delete()
  const toggleop = randomUUID(); check((await api('toggle', { targetUid: uid }, 'staff', toggleop)).ok, 'Resident deactivation')
  check((await auth.getUser(uid)).disabled && !(await get('users/' + uid)).isActive, 'Deactivation closes Auth and Firestore')
  check((await api('toggle', { targetUid: uid }, 'staff', toggleop)).ok && !(await get('users/' + uid)).isActive, 'Completed toggle retry does not toggle again')
  check((await api('toggle', { targetUid: uid }, 'staff')).ok && !(await auth.getUser(uid)).disabled, 'Resident reactivation')
  const deletion = await api('requestDeletion', { resident_id: uid, reason: 'Duplicate record' }, 'staff'); check(deletion.ok, 'Staff deletion request')
  check((await api('requestDeletion', { resident_id: uid, reason: 'Duplicate record' }, 'staff')).message.includes('already waiting'), 'One pending deletion')
  const dr = (await db.collection('deletionRequests').where('ownerUid', '==', uid).get()).docs[0].id
  check(!(await api('review', { kind: 'deletion', request_id: dr, decision: 'approve' }, 'staff')).ok, 'Staff cannot approve deletion')
  check((await api('review', { kind: 'deletion', request_id: dr, decision: 'approve', review_comment: 'Confirmed' })).ok, 'Deletion approval saga')
  check((await get('users/' + uid)).deletedAt && (await auth.getUser(uid)).disabled, 'Archive stamps account and disables Auth')
  check((await api('archives')).data.residents.some(r => r.resident_id === uid), 'Archive list includes resident')
  check(!(await api('restore', { id: uid, kind: 'residents' }, 'staff')).ok, 'Staff cannot restore')
  check((await api('restore', { id: uid, kind: 'residents' })).ok && (await get('users/' + uid)).deletedAt === null, 'Restore clears archive')
  check((await get('deletionRequests/' + dr)).reviewComment.includes('[Account later restored.]'), 'Restore preserves settled deletion marker')
  check((await api('deletions')).data.requests.find(r => r.request_id === dr).was_restored, 'Deletion list restoration state')
  for (const action of ['toggle', 'archive']) check(!(await api(action, { targetUid: ids.admin, kind: 'staff' })).ok, 'Own staff ' + action + ' refused')
  check((await api('toggle', { targetUid: ids.staff, kind: 'staff' })).ok && (await auth.getUser(ids.staff)).disabled, 'Admin deactivates staff')
  check((await api('toggle', { targetUid: ids.staff, kind: 'staff' })).ok, 'Admin reactivates staff')
  check((await api('archive', { targetUid: ids.staff, kind: 'staff' })).ok, 'Admin archives staff')
  check((await api('restore', { id: ids.staff, kind: 'staff' })).ok, 'Admin restores staff')
  // Recover an interrupted activation using the stored operation and target lock.
  const resumeop = randomUUID(), resumePath = 'accountOperations/' + createHash('sha256').update(ids.admin + ':' + resumeop).digest('hex')
  check((await api('toggle', { targetUid: uid }, 'admin', resumeop)).ok, 'Prepare saga recovery case')
  await put(resumePath, { state: 'pending' }, true); await put(lockPath, { operationPath: resumePath })
  check((await api('toggle', { targetUid: uid }, 'admin', resumeop)).ok, 'Interrupted lifecycle resumes saved intent')
  check((await get('accountLocks/' + uid)) === undefined, 'Recovered saga clears lock')
  check((await api('toggle', { targetUid: uid })).ok, 'Reactivate after recovery')
  // Browser rendering and service integration cover existing forms and queues.
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await signedPage('admin')
  const photoResult = await page.evaluate(async () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; canvas.getContext('2d').fillRect(0,0,32,32); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg')); return (await import('/barangay_survey_system/app/src/services/accountsService.js')).uploadStaffPhoto(new File([blob], 'test.jpg', {type:'image/jpeg'})) })
  check(photoResult.data.account.photo_path.startsWith('data:image/jpeg;base64,'), 'Staff actual bounded JPEG upload through browser service')
  check((await service(page, 'removeStaffPhoto')).data.account.photo_path === '', 'Staff photo removal suppresses migrated fallback')
  for (const [path, text] of [['staff/resident-management', 'Registered Residents'], ['staff/user-management', 'Staff Accounts'], ['staff/address-requests', 'Resident Requests'], ['staff/deletion-requests', 'Deletion Requests'], ['staff/deleted-accounts', 'Deleted Accounts'], ['staff/residency-records', 'Residency Records'], ['staff/complete-profile', 'Your account record.']]) {
    await page.goto(origin + path); await page.getByText(text, { exact: false }).first().waitFor(); check(true, 'Browser ' + path)
  }
  await page.goto(origin + 'staff/resident-management'); await page.locator('#resident-search').fill(number)
  await page.locator('#residents-table').getByText(number, { exact: true }).waitFor(); check(true, 'Resident browser search')
  check((await service(page, 'getResident', [uid])).data.resident.first_name === 'Edited', 'Browser account service detail')
  await page.getByRole('button', { name: 'Edit Resident', exact: true }).click(); await page.locator('#edit-resident-chooser-modal').waitFor()
  await page.locator('#edit-resident-select').selectOption(uid); await page.locator('#load-edit-resident-btn').click(); await page.locator('#edit-resident-info-modal').waitFor(); check(true, 'Browser edit resident form')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(origin + 'staff/user-management'); await page.locator('#staff-accounts-table').waitFor(); check(true, 'Phone account layout renders')
  // Purge fixtures include >500 answers and family subcollections; originals are untouched.
  check((await api('archive', { targetUid: uid })).ok, 'Archive before irreversible purge')
  const sid = `${tag}-response`, rid = `${sid}_${uid}`
  await put('responses/' + rid, { residentUid: uid, surveyId: sid, submittedAt: new Date(), legacyId: null })
  const leaves = Array.from({ length: 601 }, (_, i) => ['responses/' + rid + '/answers/' + i, { questionId: String(i), text: 'fixture' }])
  for (let i = 0; i < leaves.length; i += 300) { const batch = db.batch(); for (const [p, d] of leaves.slice(i, i + 300)) batch.set(db.doc(p), d); await batch.commit() }
  const purgeResult = await api('purge', { id: uid, kind: 'residents' }); check(purgeResult.ok, 'Bounded resident cascade purge: ' + purgeResult.status + ' ' + purgeResult.message)
  check(!(await get('users/' + uid)) && !(await get('residents/' + uid)) && !(await get('responses/' + rid)), 'Purge removes owner, profile and response parent')
  check((await db.collection('responses/' + rid + '/answers').get()).empty && (await db.collection('residents/' + uid + '/characterReferences').get()).empty, 'Purge removes answer and person leaves')
  check((await get('deletionRequests/' + dr)).status === 'approved', 'Historical deletion request survives purge as in PHP')
  check(!(await auth.getUser(uid).catch(() => null)), 'Purge removes Auth identity')
  check(diagnostics.length === 0, 'No legacy HTTP calls, production calls or browser errors: ' + diagnostics.join(', '))
  console.log(`Accounts lifecycle/browser checks: ${checks} passed`)
} finally {
  await browser?.close(); dev?.stop()
  await before.restore(); await db.terminate(); await deleteApp(admin)
}
