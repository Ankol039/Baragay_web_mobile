import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
const { base, call, commit, write, remove, user, residentProfile, person, proposal, request: proposalRequest, pointer, day } = await import('./firestore-fixtures.mjs')
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const app = 'http://127.0.0.1:5173/barangay_survey_system/app/'
const endpoint = 'http://127.0.0.1:8787/api/firebase/resident-profile.php'
const tag = `profile-${randomUUID().slice(0, 8)}`, uid = `${tag}-resident`, other = `${tag}-other`
const identifier = 'R-2026-8998', password = 'FixturePass8', docs = new Set(), diagnostics = []
let browser, dev, checks = 0, token, otherToken
const check = (condition, label) => { assert(condition, label); checks++ }
async function rest(url, auth, body, method) {
  const r = await call(url, auth, body, method)
  check(r.ok, `Fixture operation failed (${r.status})`)
  return r.body
}
async function seed(path, data) {
  await rest(`${base}:commit`, 'owner', { writes: [{ ...write(path, data), currentDocument: { exists: false } }] })
  docs.add(path)
}
async function patch(path, data) {
  const w = write(path, data); w.updateMask = { fieldPaths: Object.keys(data) }
  await rest(`${base}:commit`, 'owner', { writes: [w] })
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Local dev server did not start')
}
async function service(page, name, ...args) {
  return page.evaluate(async ({ name, args }) => {
    const service = await import('/barangay_survey_system/app/src/services/profileService.js')
    try { return await service[name](...args) }
    catch (error) { return { error: error.message, status: error.status } }
  }, { name, args })
}
async function api(action, values = {}, auth = token) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, action, idToken: auth }) })
  return { status: r.status, ...await r.json() }
}
async function queue(collection) {
  return (await rest(`${base}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: collection }],
    where: { fieldFilter: { field: { fieldPath: 'ownerUid' }, op: 'EQUAL', value: { stringValue: uid } } } } })).filter(r => r.document).map(r => r.document)
}
async function collectRequests() {
  for (const collection of ['nameAddressRequests', 'familyRequests']) for (const row of await queue(collection)) {
    const path = `${collection}/${row.name.split('/').at(-1)}`; docs.add(path)
    if (collection === 'familyRequests') for (const group of ['children', 'characterReferences']) {
      const rows = await rest(`${base}/${path}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: group }] } })
      for (const row of rows) if (row.document) docs.add(`${path}/${group}/${row.document.name.split('/').at(-1)}`)
    }
  }
}
async function clearQueue() {
  await collectRequests()
  const paths = [...docs].filter(p => p.startsWith('nameAddressRequests/') || p.startsWith('familyRequests/') || p.startsWith('pendingRequests/'))
  if (paths.length) await rest(`${base}:commit`, 'owner', { writes: paths.map(remove) })
}
const family = { occupation: 'Teacher', hotline_number: '(045) 123-4567', is_married: '1', has_children: '1',
  spouse_first_name: 'Spouse', spouse_last_name: 'Person', father_first_name: 'Father', mother_first_name: 'Mother',
  children: [{ first_name: 'Child', last_name: 'Person', courtesy_title: 'Others', courtesy_title_other: 'Dr.' }, { first_name: '', last_name: '' }],
  references: [{ first_name: 'Reference', last_name: 'Person', gender: 'woman' }], family_reason: 'Correct the family record' }
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Local emulators running')
  await rest(`http://127.0.0.1:8080/emulator/v1/projects/${project}:securityRules`, 'owner',
    { rules: { files: [{ name: 'firestore.rules', content: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') }] } }, 'PUT')
  for (const id of [uid, other]) {
    const email = `${id}@example.invalid`
    await rest(`${authBase}/projects/${project}/accounts`, 'owner', { localId: id, email, password })
    await seed(`users/${id}`, user(id, 'resident', { identifier: id === uid ? identifier : 'R-2026-8997' }))
    await seed(`residents/${id}`, residentProfile(id, id === uid ? { residencyStatus: 'temporary', temporaryAddress: { ...residentProfile(id).permanentAddress, householdNumber: '2' }, residenceType: 'BH' } : {}))
    const signed = await rest(`${authBase}/accounts:signInWithPassword?key=emulator-only`, null, { email, password, returnSecureToken: true })
    if (id === uid) token = signed.idToken; else otherToken = signed.idToken
  }
  const normalizedIdentifier = identifier.toLowerCase()
  await seed(`identifierAliases/residentNumber_${createHash('sha256').update(normalizedIdentifier).digest('hex')}`,
    { kind: 'residentNumber', normalizedIdentifier, uid, authEmail: `${uid}@example.invalid`, createdAt: day })
  for (const kind of ['nameAddress', 'family']) docs.add(`pendingRequests/${uid}_${kind}`)
  dev = startAuthDev()
  await Promise.all([ready(app), ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')])
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Production request'); return route.abort() })
  await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/firebase/'), route => { diagnostics.push('Legacy request'); return route.abort() })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.push(error.message))
  await page.goto(app + 'login'); await page.locator('#identifier').fill(identifier); await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Log In', exact: true }).click(); await page.waitForURL(app + 'resident/dashboard')
  await page.goto(app + 'resident/profile'); await page.getByRole('heading', { name: 'My Profile', exact: true }).waitFor()
  let data = (await service(page, 'getProfile')).data
  check(data.resident.temp_household_number === '2' && data.display.residence_type === 'Boarding House', 'Both address sets and original labels loaded')
  const names = { ...data.resident, first_name: 'Corrected', courtesy_title: 'Others', courtesy_title_other: 'Engr.', temp_purok: 'New temporary purok' }
  console.log('Checking PHP validation and immediate contact saves')
  check((await service(page, 'saveContact', {})).error === 'Please provide your email or contact number to update.', 'Empty contact message unchanged')
  check((await service(page, 'saveContact', { contact_number: 'abcdefg' })).error === 'A contact number can only contain digits, spaces, +, -, and brackets.', 'Invalid contact message unchanged')
  await page.getByRole('button', { name: 'Edit Contact', exact: true }).click()
  await page.locator('#email').fill('profile@example.invalid'); await page.locator('#contact_number').fill('+63 (917) 123-4567')
  await page.getByRole('button', { name: 'Save Email & Contact', exact: true }).click()
  await page.locator('#toast-container').getByText('Your email and contact information have been updated successfully.', { exact: true }).waitFor()
  check((await service(page, 'getProfile')).data.resident.email === 'profile@example.invalid', 'Contact persists immediately')
  check((await queue('nameAddressRequests')).length + (await queue('familyRequests')).length === 0, 'Contact creates no request')
  check((await service(page, 'saveContact', { email: 'a@b', contact_number: '0917\t1234' })).ok, 'Original permissive email and PHP whitespace contact semantics retained')
  for (const [input, message] of [
    ['', 'Choose the corrected birthdate.'], [data.today, 'Birthdate must be in the past.'], ['2000-01-01', 'That is the birthdate already on record.'],
  ]) check((await service(page, 'requestBirthdate', { birthdate: input })).error === message, 'Birthdate validation message unchanged')
  for (const [input, message] of [
    [{ ...names, first_name: '' }, 'First name and last name cannot be blank.'],
    [{ ...names, household_number: '', province: '' }, 'Please fill in: Household Number, Province.'],
    [{ ...names, postal_code: '123' }, 'A Philippine postal code is four digits.'],
    [{ ...names, purok: 'a'.repeat(61) }, 'These entries are too long: Purok (max 60 characters).'],
    [{ ...names, temp_purok: 'a'.repeat(61) }, 'These entries are too long: Temporary Purok (max 60 characters).'],
    [data.resident, 'Nothing has changed yet. Edit a name or address field before sending the request.'],
  ]) check((await service(page, 'requestNameAddress', input)).error === message, 'Name/address validation message unchanged')
  for (const [input, message] of [
    [{ ...family, children: [{ last_name: 'Person' }] }, 'Child 1 needs a first name.'],
    [{ ...family, references: [{ first_name: 'Reference' }] }, 'Character reference 1 needs a surname.'],
    [{ ...family, family_reason: '' }, 'Give a short reason so staff know what you are correcting.'],
    [{ ...family, spouse_first_name: '' }, 'Enter your spouse\'s first name, or answer No to "Are you married?".'],
    [{ ...family, references: [] }, 'At least one character reference is required.'],
    [{ ...family, hotline_number: 'invalid' }, `Check the hotline number. ${data.fields.hotline_hint}`],
  ]) check((await service(page, 'requestFamily', input)).error === message, 'Family validation order/message unchanged')
  check((await api('family', { ...family, references: {} })).message === 'Invalid request field: references.', 'Nonarray family rows refused')
  check((await api('get', {}, 'invalid')).ok === false, 'Forged credential refused')
  const otherData = await api('contact', { email: 'other@example.invalid', uid, ownerUid: uid }, otherToken)
  check(otherData.data.resident.resident_number === 'R-2026-8997', 'Spoofed UID ignored; writes remain token-owned')
  console.log('Checking each browser request flow and shared pending slots')
  await page.getByRole('button', { name: 'Request Change', exact: true }).nth(1).click()
  await page.locator('#birthdate').fill('1999-01-02'); await page.locator('#request-birthdate-modal').getByRole('button', { name: 'Send Request' }).click()
  await page.locator('#toast-container').getByText('Your birthdate correction has been sent to staff for review.', { exact: true }).waitFor()
  let q = await queue('nameAddressRequests')
  check(q.length === 1 && q[0].fields.proposed.mapValue.fields.birthdate.timestampValue.startsWith('1999-01-02'), 'Birthdate-only request stored')
  check((await service(page, 'getProfile')).data.resident.birthdate === '2000-01-01', 'Pending birthdate does not change live record')
  check((await service(page, 'requestBirthdate', { birthdate: '1998-01-01' })).error === 'You already have a pending request under review.', 'Duplicate birthdate refused')
  check((await service(page, 'requestNameAddress', names)).error === 'You already have a pending name/address request under review.', 'Birthdate blocks name/address')
  check((await service(page, 'requestFamily', family)).error === 'You already have a change waiting for review. Staff will look at that one first.', 'Birthdate blocks family')
  check((await service(page, 'saveContact', { email: 'pending@example.invalid' })).ok, 'Contact remains editable during pending correction')
  await clearQueue(); await page.reload(); await page.getByRole('heading', { name: 'My Profile', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Request Change', exact: true }).first().click()
  await page.locator('#request_first_name').fill('Corrected'); await page.locator('#temp_purok').fill('New temporary purok')
  await page.getByRole('button', { name: 'Request Name/Address Change', exact: true }).click()
  await page.locator('#toast-container').getByText('Your name and address update request has been sent to staff for review.', { exact: true }).waitFor()
  q = await queue('nameAddressRequests')
  check(q.length === 1 && q[0].fields.proposed.mapValue.fields.name.mapValue.fields.firstName.stringValue === 'Corrected', 'Name/address proposal stored')
  check(q[0].fields.proposed.mapValue.fields.temporaryAddress.mapValue.fields.purok.stringValue === 'New temporary purok', 'Temporary corrections stored separately')
  check(q[0].fields.previousAddress.stringValue === data.resident.address, 'Previous address snapshot preserved')
  check((await service(page, 'getProfile')).data.resident.first_name === 'Fixture', 'Pending name does not change live record')
  await clearQueue(); await page.reload(); await page.getByRole('heading', { name: 'My Profile', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Request Change', exact: true }).last().click()
  await page.locator('#req_occupation').fill('Teacher'); await page.locator('#family_reason').fill(family.family_reason)
  await page.locator('[name="references[0][first_name]"]').fill('Reference'); await page.locator('[name="references[0][last_name]"]').fill('Person')
  await page.locator('#family-request-modal').getByRole('button', { name: 'Send Request', exact: true }).click()
  await page.locator('#family-request-modal').waitFor({ state: 'hidden' })
  q = await queue('familyRequests')
  check(q.length === 1 && q[0].fields.reason.stringValue === family.family_reason, 'Family browser request stored')
  check((await service(page, 'getProfile')).data.pending_family_request.requested_at_label.length > 0, 'Original pending family timestamp present')
  check((await service(page, 'requestBirthdate', { birthdate: '1999-01-01' })).error === 'You already have a pending request under review.', 'Family blocks birthdate')
  await clearQueue()
  check((await service(page, 'requestFamily', family)).ok, 'Full family including spouse/parents/repeated children accepted')
  await collectRequests()
  const children = [...docs].filter(p => p.includes('/children/'))
  check(children.length === 1, 'Blank child rows dropped')
  const child = await rest(`${base}/${children[0]}`, 'owner')
  check(child.fields.person.mapValue.fields.courtesyTitle.stringValue === 'Dr.', 'Custom title resolved with original PHP helper')
  await clearQueue()
  const competing = await Promise.all([api('birthdate', { birthdate: '1998-01-01' }), api('family', family), api('nameAddress', names)])
  check(competing.filter(r => r.ok).length === 1, 'Competing cross-type requests have one winner')
  check((await queue('nameAddressRequests')).length + (await queue('familyRequests')).length === 1, 'One pending document after competition')
  await clearQueue()
  check(!(await api('family', { ...family, references: Array.from({ length: 499 }, () => ({ first_name: 'Reference', last_name: 'Person' })) })).ok, 'Oversized atomic family save fails safely')
  check((await queue('familyRequests')).length === 0, 'Oversized family save leaves no partial proposal')
  // Imported pending documents without pointer still block new requests.
  const imported = `${tag}-imported`
  await seed(`nameAddressRequests/${imported}`, proposalRequest('nameAddress', uid, proposal()))
  check((await service(page, 'requestFamily', family)).error === 'You already have a change waiting for review. Staff will look at that one first.', 'Legacy pending request without pointer blocks new proposal')
  await clearQueue()
  console.log('Checking compressed photo, persistence, header and removal')
  const legacyJpeg = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 8; return c.toDataURL('image/jpeg') })
  await seed(`profileImages/${uid}`, { ownerUid: uid, mimeType: 'image/jpeg', base64: legacyJpeg.split(',')[1], updatedAt: day })
  await page.reload(); await page.locator('.profile-photo-preview').waitFor()
  check(await page.locator('.profile-photo-preview').getAttribute('src') === legacyJpeg, 'Imported image fallback displays before replacement')
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 640
    const ctx = c.getContext('2d'), pixels = ctx.createImageData(640, 640)
    for (let i = 0; i < pixels.data.length; i += 4) { pixels.data[i] = i * 13 % 255; pixels.data[i + 1] = i * 23 % 255; pixels.data[i + 2] = i * 31 % 255; pixels.data[i + 3] = 255 }
    ctx.putImageData(pixels, 0, 0); return c.toDataURL('image/png').split(',')[1]
  })
  await page.reload(); await page.locator('#profile_photo').waitFor({ state: 'attached' })
  await page.locator('#profile_photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await page.getByRole('button', { name: 'Confirm & Upload', exact: true }).click()
  await page.getByRole('heading', { name: 'Profile Updated', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const stored = await rest(`${base}/residents/${uid}`, 'owner'), photo = stored.fields.photoDataUrl.stringValue
  check((await call(`${base}/profileImages/${uid}`, 'owner')).status === 404, 'Replacement removes the retired imported image atomically')
  check(photo.startsWith('data:image/jpeg;base64,') && Buffer.from(photo.split(',')[1], 'base64').length <= 60 * 1024, 'JPEG data URL in resident doc stays within 60 KiB')
  const dimensions = await page.evaluate(async photo => { const img = new Image(); img.src = photo; await img.decode(); return [img.naturalWidth, img.naturalHeight] }, photo)
  check(dimensions[0] <= 256 && dimensions[0] === dimensions[1], 'Stored photo is square and at most 256 px')
  await page.reload(); await page.locator('.profile-photo-preview').waitFor()
  check(await page.locator('.profile-photo-preview').getAttribute('src') === photo, 'Photo persists on reload')
  check(await page.locator('.account-chip img').getAttribute('src') === photo, 'Header shows resident photo')
  for (const [value, message] of [['', 'Please select a photo to upload.'], ['data:image/jpeg;base64,YmFk', 'Uploaded file must be a valid image.']]) {
    check((await api('photo', { photo: value })).message === message, 'Invalid photo preserves original message')
  }
  // Direct callers cannot upload an unbounded or oversized JPEG around the client resize.
  const oversized = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 320; return c.toDataURL('image/jpeg') })
  check((await api('photo', { photo: oversized })).message === 'The selected photo is too large.', 'Server independently checks photo dimensions')
  await page.getByRole('button', { name: 'Remove Photo', exact: true }).click()
  await page.locator('#confirm-modal-proceed').click()
  await page.getByText('No photo uploaded', { exact: true }).waitFor()
  check((await rest(`${base}/residents/${uid}`, 'owner')).fields.photoDataUrl.stringValue === '', 'Removal persisted without changing other fields')
  await page.reload(); await page.getByText('No photo uploaded', { exact: true }).waitFor()
  check(await page.locator('.account-chip img').count() === 0, 'Removal restores header initial')
  console.log('Checking direct rule bypasses and lifecycle refusal')
  const account = user(uid, 'resident', { identifier })
  const direct = kind => proposalRequest(kind, uid, kind === 'family' ? residentProfile(uid).household : proposal(),
    { ownerIdentifier: identifier, ownerDisplayName: account.displayName, requestedByName: account.displayName, firstReferenceId: kind === 'family' ? 'ref' : null })
  const req = direct('nameAddress'), familyReq = direct('family')
  const familyWrites = [write(`familyRequests/${tag}-direct-family`, familyReq, ['requestedAt']),
    write(`pendingRequests/${uid}_family`, pointer(uid, 'family', `${tag}-direct-family`)),
    write(`familyRequests/${tag}-direct-family/characterReferences/ref`, { person: person(), displayOrder: 0, legacyId: null }, ['createdAt'])]
  const nameWrites = [write(`nameAddressRequests/${tag}-direct`, req, ['requestedAt']), write(`pendingRequests/${uid}_nameAddress`, pointer(uid, 'nameAddress', `${tag}-direct`))]
  check((await commit(token, [...nameWrites, ...familyWrites])).status === 403, 'Same-batch cross-kind pointer bypass denied')
  check((await commit(token, nameWrites)).ok, 'Valid direct birthdate request fits rules budget')
  check((await commit(token, familyWrites)).status === 403, 'Existing birthdate slot blocks direct family request')
  await clearQueue()
  check((await commit(token, familyWrites)).ok, 'Valid direct family request fits rules budget')
  check((await commit(token, nameWrites)).status === 403, 'Existing family slot blocks direct birthdate request')
  await clearQueue()
  check((await commit(otherToken, nameWrites)).status === 403, 'Other resident cannot submit own proposal')
  const changed = write(`residents/${uid}`, { photoDataUrl: photo }, ['updatedAt']); changed.updateMask = { fieldPaths: ['photoDataUrl'] }
  check((await commit(token, [changed])).status === 403, 'Photo must pass the trusted JPEG validator')
  const protectedWrite = write(`residents/${uid}`, { name: { ...person(), firstName: 'Bypass' } }, ['updatedAt']); protectedWrite.updateMask = { fieldPaths: ['name'] }
  check((await commit(token, [protectedWrite])).status === 403, 'Direct self identity change denied')
  check((await call(`${base}/residents/${other}`, token)).status === 403, 'Other resident profile private')
  check((await call(`${base}:runQuery`, null, { structuredQuery: { from: [{ collectionId: 'residents' }] } })).status === 403, 'Unauthenticated collection query denied')
  await page.setViewportSize({ width: 390, height: 844 }); await page.reload(); await page.getByRole('heading', { name: 'My Profile', exact: true }).waitFor()
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone layout retained')
  await patch(`users/${uid}`, { isActive: false })
  check((await api('contact', { email: 'inactive@example.invalid' })).status === 403, 'Deactivated resident write refused')
  await patch(`users/${uid}`, { isActive: true, isFirstLogin: true })
  check((await api('get')).status === 403, 'First-login resident gated')
  await patch(`users/${uid}`, { isFirstLogin: false })
  assert.deepEqual(diagnostics, [], 'No production, legacy or browser errors')
  console.log(`PASS: ${checks} profile emulator/browser checks; contact, all request flows, shared pending limit, PHP messages and compressed resident photo.`)
} finally {
  await browser?.close(); dev?.stop()
  await collectRequests()
  for (const collection of ['nameAddressRequests', 'familyRequests']) docs.add(`${collection}/${tag}-${collection === 'familyRequests' ? 'direct-family' : 'direct'}`)
  docs.add(`familyRequests/${tag}-direct-family/characterReferences/ref`)
  for (const id of [uid, other]) {
    const audit = await call(`${base}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: 'loginHistory' }], where: { fieldFilter: { field: { fieldPath: 'actorUid' }, op: 'EQUAL', value: { stringValue: id } } } } })
    for (const row of audit.body || []) if (row.document) docs.add(`loginHistory/${row.document.name.split('/').at(-1)}`)
  }
  if (docs.size) check((await commit('owner', [...docs].map(remove))).ok, 'Only synthetic fixtures cleaned')
  for (const id of [uid, other]) await call(`${authBase}/projects/${project}/accounts:delete`, 'owner', { localId: id })
}
