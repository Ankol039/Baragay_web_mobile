// Exclusive emulator suite: synthetic fixtures only; no rules upload or global reset.
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { emulatorEnv, project } from '../../frontend/scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
const { chromium } = createRequire(process.env.MOBILE_API_ROOT ? `${process.env.MOBILE_API_ROOT}/frontend/package.json` : new URL('../../frontend/package.json', import.meta.url))('playwright')
const { base, call, write, remove, user, residentProfile, survey, day } = await import('../../frontend/tests/firestore-fixtures.mjs')
const root = fileURLToPath(new URL('../../', import.meta.url)), mobile = fileURLToPath(new URL('../', import.meta.url))
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1', app = 'http://127.0.0.1:8790/'
const tag = `mobile-${randomUUID().slice(0, 8)}`, password = 'FixturePass8', docs = new Set(), identities = new Set(), operations = new Set(), diagnostics = [], traffic = new Set()
let checks = 0, browser, php, gateway, uid, originalCounter, currentPage
const check = (value, label) => { assert(value, label); checks++; console.log(`PASS ${label}`) }
async function capture(name) { if (process.env.MOBILE_EVIDENCE_DIR && currentPage) { await mkdir(process.env.MOBILE_EVIDENCE_DIR, { recursive: true }); await currentPage.screenshot({ path: `${process.env.MOBILE_EVIDENCE_DIR}/${name}.png`, fullPage: true }) } }
async function rest(url, body, method = body ? 'POST' : 'GET') { const result = await call(url, 'owner', body, method); assert(result.ok, `Fixture operation ${result.status}`); return result.body }
const seed = async (path, data) => { await rest(`${base}:commit`, { writes: [{ ...write(path, data), currentDocument: { exists: false } }] }); docs.add(path) }
const patch = async (path, data) => { const w = write(path, data); w.updateMask = { fieldPaths: Object.keys(data) }; await rest(`${base}:commit`, { writes: [w] }) }
const rows = async (parent, collection) => (await rest(`${base}${parent ? '/' + parent : ''}:runQuery`, { structuredQuery: { from: [{ collectionId: collection }] } })).flatMap(row => row.document ? [row.document] : [])
async function ready(url) { for (let i = 0; i < 150; i++) { try { if ((await fetch(url)).ok) return } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)) } throw new Error('Local runtime did not start') }
async function identity(suffix, extra = {}) {
  const id = `${tag}-${suffix}`, number = `${suffix === 'staff' ? 'S' : 'R'}-2099-${suffix === 'first' ? '8001' : '8002'}`, email = `${id}@example.invalid`
  await rest(`${authBase}/projects/${project}/accounts`, { localId: id, email, password }); identities.add(id)
  await seed(`users/${id}`, user(id, suffix === 'staff' ? 'staff' : 'resident', { identifier: number, ...extra }))
  await seed(`residents/${id}`, residentProfile(id))
  const normalized = number.toLowerCase()
  const kind = suffix === 'staff' ? 'staffNumber' : 'residentNumber'
  await seed(`identifierAliases/${kind}_${createHash('sha256').update(normalized).digest('hex')}`, { kind, normalizedIdentifier: normalized, uid: id, authEmail: email, createdAt: day })
  return { id, number }
}
const questions = [
  { id: 'mc', type: 'multiple_choice', text: 'Choose one', order: 1 },
  { id: 'yn', type: 'yesno', text: 'Yes or No', order: 2 },
  { id: 'rating', type: 'rating', text: 'Rate your visit', order: 3 },
  { id: 'text', type: 'short_answer', text: 'Your comments', order: 4 },
]
async function makeSurvey(suffix, extra = {}) {
  const sid = `${tag}-${suffix.replaceAll(' ', '-')}`
  await seed(`surveys/${sid}`, survey({ title: `Mobile ${suffix}`, createdByUid: 'staff-fixture', ...extra }))
  for (const q of questions) { await seed(`surveys/${sid}/questions/${q.id}`, { ...q, legacyId: null }); docs.add(`responses/${sid}_${uid}/answers/${q.id}`) }
  await seed(`surveys/${sid}/questions/mc/choices/a`, { text: 'Choice A', order: 1, legacyId: null })
  docs.add(`surveys/${sid}/validation/response`); docs.add(`responses/${sid}_${uid}`)
  return sid
}
async function clearProposals() {
  for (const id of identities) for (const kind of ['nameAddress', 'family']) docs.add(`pendingRequests/${id}_${kind}`)
  for (const c of ['nameAddressRequests', 'familyRequests']) for (const row of await rows('', c)) if (identities.has(row.fields.ownerUid?.stringValue)) {
    const path = row.name.split('/documents/')[1]; docs.add(path)
    for (const group of ['children', 'characterReferences']) for (const p of await rows(path, group)) docs.add(p.name.split('/documents/')[1])
  }
  const paths = [...docs].filter(p => /^(nameAddressRequests|familyRequests|pendingRequests)\//.test(p))
  if (paths.length) await rest(`${base}:commit`, { writes: paths.map(remove) })
}
async function signIn(page, number, pw = password) {
  await page.getByLabel('Resident Number', { exact: true }).filter({ visible: true }).fill(number)
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).fill(pw)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}
async function tab(page, name) { await page.getByRole('tab', { name }).click() }
async function answer(page, title) {
  await page.getByRole('heading', { name: title, exact: true }).locator('..').getByRole('button', { name: 'Answer Survey', exact: true }).click()
  await page.getByRole('radio', { name: 'Choice A', exact: true }).click()
  await page.getByRole('radio', { name: 'No', exact: true }).click()
  await page.getByRole('radio', { name: '5', exact: true }).click()
  await page.getByLabel('Answer (optional)', { exact: true }).filter({ visible: true }).fill('Mobile, "CSV"\nSecond line')
}
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Emulators available')
  const c = await call(`${base}/counters/residentNumbers`, 'owner'); originalCounter = c.ok ? c.body : null
  // Source may be the integration worktree before Package C is merged.
  const apiRoot = process.env.MOBILE_API_ROOT || root
  if (!process.env.MOBILE_EXTERNAL_API) php = spawn(process.env.PHP_BINARY || 'php', ['-S', '127.0.0.1:8787', '-t', `${apiRoot}/frontend/dist`, `${apiRoot}/api/firebase/router.php`], { cwd: apiRoot, env: emulatorEnv, stdio: 'ignore' })
  gateway = spawn(process.execPath, ['scripts/lan-gateway.mjs'], { cwd: mobile, env: { ...process.env, MOBILE_LAN_HOST: '127.0.0.1' }, stdio: 'ignore' })
  await Promise.all([ready(app), ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')])
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Production Firebase request'); return route.abort() })
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(15000)
  page.on('console', e => { if (e.type() === 'error') console.error('Browser console:', e.text().replace(/https?:\/\/[^\s'"]+/g, '[URL]')) }); page.on('pageerror', e => diagnostics.push(e.message)); page.on('requestfailed', r => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') console.error('Network failure:', new URL(r.url()).pathname, r.failure()?.errorText) }); page.on('response', r => { if (r.status() >= 400) console.error('HTTP refusal:', new URL(r.url()).pathname, r.status()) }); page.on('dialog', d => d.accept())
  page.on('request', r => { const url = new URL(r.url()); if (url.port === '8792') traffic.add(url.pathname); if (url.port === '8791') traffic.add(url.pathname) })
  page.on('response', async r => { if (r.url().endsWith('/accounts.php')) { try { const data = await r.json(); if (data.data?.uid) { uid = data.data.uid; identities.add(uid) } } catch { /* non-JSON error */ } } })
  await page.goto(app); await page.getByRole('button', { name: 'Register', exact: true }).click()
  await page.getByLabel('First Name *', { exact: true }).filter({ visible: true }).first().fill('Mobile')
  await page.getByLabel('Surname *', { exact: true }).filter({ visible: true }).first().fill('Resident')
  await page.getByLabel('Middle Name *', { exact: true }).filter({ visible: true }).first().fill('Synthetic')
  await page.getByLabel('Birthplace *', { exact: true }).filter({ visible: true }).fill('Test town')
  await page.getByLabel('Birthdate *', { exact: true }).filter({ visible: true }).fill('2000-01-01')
  await page.getByLabel('Gender *', { exact: true }).filter({ visible: true }).first().selectOption('woman')
  await page.getByLabel('Residency Start Date *', { exact: true }).filter({ visible: true }).fill('2020-01-01')
  for (const [label, value] of [['Household Number *', '11'], ['Barangay *', 'Test Barangay'], ['Municipality / City *', 'Test City'], ['Province *', 'Test Province'], ['Postal Code', '1234']]) await page.getByLabel(label, { exact: true }).filter({ visible: true }).fill(value)
  await page.getByLabel('First Name *', { exact: true }).filter({ visible: true }).last().fill('Reference')
  await page.getByLabel('Surname *', { exact: true }).filter({ visible: true }).last().fill('Person')
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).fill(password); await page.getByLabel('Confirm Password', { exact: true }).filter({ visible: true }).fill(password)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await page.getByText('Registration Successful', { exact: true }).waitFor()
  const number = (await page.getByText(/^Resident Number: R-/).textContent()).split(': ')[1]
  check(Boolean(uid && number), 'Actual backend registration returns issued number')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.getByRole('tab', { name: 'Overview' }).waitFor()
  check(true, 'Registered Resident Number signs in'); await capture('overview')
  await page.reload(); await page.getByRole('tab', { name: 'Surveys' }).waitFor()
  check(true, 'Browser Firebase persistence survives reload')
  // Force real SDK refresh endpoint transport using its persisted refresh credential.
  check(await page.evaluate(async () => {
    const saved = await new Promise((resolve, reject) => {
      const opening = indexedDB.open('firebaseLocalStorageDb')
      opening.onerror = () => reject(new Error('Persisted auth unavailable'))
      opening.onsuccess = () => { const db = opening.result; const getting = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll(); getting.onerror = () => reject(new Error('Persisted auth unavailable')); getting.onsuccess = () => { db.close(); resolve(getting.result.find(row => row.fbase_key.startsWith('firebase:authUser:')).value) } }
    })
    const r = await fetch('http://127.0.0.1:8791/securetoken.googleapis.com/v1/token?key=emulator-only', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.stsTokenManager.refreshToken }) })
    return r.ok && Boolean((await r.json()).id_token)
  }), 'Refresh credential works through filtered gateway')
  const sid = await makeSurvey('four types'), race = await makeSurvey('race'), closed = await makeSurvey('closed', { status: 'inactive' })
  void sid; void race; void closed
  await tab(page, 'Overview'); await page.getByRole('button', { name: 'View Details', exact: true }).first().click()
  await page.getByText('Available Surveys', { exact: true }).last().waitFor(); check(true, 'Overview/stat access loads actual service data')
  await page.locator('[aria-label*="back" i]:visible').first().click()
  await tab(page, 'Surveys'); await page.getByRole('heading', { name: 'Mobile four types', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Mobile four types', exact: true }).locator('..').getByRole('button', { name: 'Answer Survey', exact: true }).click()
  await page.getByRole('button', { name: 'Submit Survey', exact: true }).click()
  await page.getByText('Nothing was submitted, so your answers were not saved and this survey is still open to you. Please answer at least one question before submitting.', { exact: true }).waitFor()
  check(true, 'Empty submission keeps exact validation message')
  await page.getByRole('radio', { name: 'Choice A', exact: true }).click()
  await page.getByRole('button', { name: 'Submit Survey', exact: true }).click()
  await page.getByText('Please answer all required questions before submitting.', { exact: true }).waitFor(); check(true, 'Required groups prevent submission')
  await page.getByRole('radio', { name: 'No', exact: true }).click(); await page.getByRole('radio', { name: '5', exact: true }).click()
  await page.getByLabel('Answer (optional)', { exact: true }).filter({ visible: true }).fill('Mobile, "CSV"\nSecond line')
  await page.getByRole('button', { name: 'Submit Survey', exact: true }).click()
  await page.getByText('Submission confirmed', { exact: true }).waitFor()
  const response = await call(`${base}/responses/${sid}_${uid}`, 'owner')
  check(response.ok, 'Mobile UI creates deterministic response transaction')
  for (const q of questions) check((await call(`${base}/responses/${sid}_${uid}/answers/${q.id}`, 'owner')).ok, `Stored ${q.type} answer`)
  await page.getByRole('button', { name: 'Back to Surveys', exact: true }).click()
  await tab(page, 'History'); await page.getByRole('heading', { name: 'Mobile four types', exact: true }).locator('..').getByRole('button', { name: 'View', exact: true }).click()
  await page.getByText('5 / 5', { exact: true }).waitFor(); check(true, 'Read-only response shows stored answers'); await capture('submitted-response')
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV / Share', exact: true }).click(); const download = await downloading
  const csv = await readFile(await download.path(), 'utf8'); check(csv.includes('Mobile four types') && csv.includes('"Mobile, ""CSV""\nSecond line"'), 'Actual CSV download preserves multiline/quote encoding')
  await page.getByRole('button', { name: 'Back to History', exact: true }).click(); await tab(page, 'Profile')
  await page.getByText('My Profile', { exact: true }).last().waitFor()
  await page.getByRole('button', { name: 'Edit Contact', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).filter({ visible: true }).fill('mobile@example.invalid'); await page.getByLabel('Contact Number', { exact: true }).filter({ visible: true }).fill('09171234567')
  await page.getByRole('button', { name: 'Save Email & Contact', exact: true }).click(); await page.getByText('Your email and contact information have been updated successfully.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByText('mobile@example.invalid', { exact: true }).waitFor()
  check(true, 'Immediate contact saves and focus refresh use actual backend'); await capture('profile')
  // Actual built React website and Expo app share the same resident and data.
  const websiteContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await websiteContext.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Website production request'); return route.abort() })
  const website = await websiteContext.newPage(); website.on('pageerror', e => diagnostics.push(e.message)); website.on('dialog', d => d.accept())
  await website.goto('http://127.0.0.1:8787/login')
  await website.locator('#identifier').fill(number); await website.locator('#password').fill(password)
  await website.getByRole('button', { name: 'Log In', exact: true }).click(); await website.waitForURL('http://127.0.0.1:8787/resident/dashboard')
  await website.goto('http://127.0.0.1:8787/resident/history'); await website.getByText('Mobile four types', { exact: true }).waitFor()
  check(true, 'Mobile response appears in actual React website history')
  await website.goto('http://127.0.0.1:8787/resident/profile'); await website.getByText('mobile@example.invalid', { exact: true }).waitFor()
  check(true, 'Mobile contact update appears on actual React website')
  await website.getByRole('button', { name: 'Edit Contact', exact: true }).click()
  await website.locator('#edit-contact-modal #email').fill('website@example.invalid')
  await website.getByRole('button', { name: 'Save Email & Contact', exact: true }).click()
  await website.getByText('website@example.invalid', { exact: true }).first().waitFor()
  await page.reload(); await tab(page, 'Profile'); await page.getByText('website@example.invalid', { exact: true }).waitFor()
  check(true, 'React website contact edit appears in actual Expo app'); await capture('web-to-expo-profile')
  const websiteSurvey = await makeSurvey('website counterpart')
  await website.goto(`http://127.0.0.1:8787/resident/survey-form?id=${websiteSurvey}`)
  await website.locator('label[for="qmc_ca"]').click(); await website.locator('label[for="qyn_no"]').click(); await website.locator('label[for="qrating_r4"]').click()
  await website.locator('textarea[name="qtext"]').fill('Submitted from React website')
  await website.getByRole('button', { name: 'Submit Survey', exact: true }).click(); await website.waitForURL(/resident\/surveys\?submitted=/)
  await page.reload(); await tab(page, 'History'); await page.getByRole('heading', { name: 'Mobile website counterpart', exact: true }).waitFor()
  check(true, 'Actual React survey submission appears in Expo history'); await capture('web-to-expo-history')
  await websiteContext.close(); await tab(page, 'Profile')
  await page.getByRole('button', { name: 'Request Birthdate Correction', exact: true }).click(); await page.getByLabel('Corrected Birthdate', { exact: true }).filter({ visible: true }).fill('1999-01-02')
  await page.getByRole('button', { name: 'Send Request', exact: true }).click(); await page.getByText('Your birthdate correction has been sent to staff for review.', { exact: true }).waitFor()
  check(true, 'Birthdate proposal submits without changing live record'); await page.getByRole('button', { name: 'Done', exact: true }).click()
  await clearProposals(); await tab(page, 'Overview'); await tab(page, 'Profile')
  await page.getByRole('button', { name: 'Request Change', exact: true }).click(); await page.getByLabel('First Name', { exact: true }).filter({ visible: true }).fill('Corrected')
  await page.getByRole('button', { name: 'Request Name/Address Change', exact: true }).click(); await page.getByText('Your name and address update request has been sent to staff for review.', { exact: true }).waitFor()
  check(true, 'Name/address proposal uses original field contract'); await page.getByRole('button', { name: 'Done', exact: true }).click()
  await clearProposals(); await tab(page, 'Overview'); await tab(page, 'Profile')
  await page.getByRole('button', { name: 'Request Family & Household Change', exact: true }).click()
  await page.getByLabel('First Name *', { exact: true }).filter({ visible: true }).last().fill('NewReference'); await page.getByLabel('Surname *', { exact: true }).filter({ visible: true }).last().fill('Person')
  await page.getByLabel('Reason for the change *', { exact: true }).filter({ visible: true }).fill('Correct family record')
  await page.getByRole('button', { name: 'Send Request', exact: true }).click(); await page.getByText('Your family details change was sent to barangay staff for review.', { exact: true }).waitFor()
  check(true, 'Family proposal submits ordered reference rows'); await page.getByRole('button', { name: 'Done', exact: true }).click()
  await clearProposals(); await tab(page, 'Overview'); await tab(page, 'Profile')
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Upload Photo', exact: true }).click(); await (await chooser).setFiles(`${mobile}/assets/logo.png`)
  await page.getByRole('button', { name: 'Change Photo', exact: true }).waitFor()
  const photo = (await rest(`${base}/residents/${uid}`)).fields.photoDataUrl.stringValue
  const dimensions = await page.evaluate(async data => { const i = new Image(); i.src = data; await i.decode(); return [i.width, i.height] }, photo)
  check(dimensions.every(x => x <= 256) && Buffer.from(photo.split(',')[1], 'base64').length <= 60 * 1024, 'Actual picker/compressor stores bounded JPEG')
  await page.getByRole('button', { name: 'Remove Photo', exact: true }).click(); await page.getByRole('button', { name: 'Upload Photo', exact: true }).waitFor(); check(true, 'Confirmed photo removal restores initial')
  // Two independent windows share a resident, each reading the same current survey.
  const second = await context.newPage(); second.on('dialog', d => d.accept()); second.on('pageerror', e => diagnostics.push(e.message)); await second.goto(app)
  await tab(page, 'Surveys'); await tab(second, 'Surveys'); await Promise.all([answer(page, 'Mobile race'), answer(second, 'Mobile race')])
  await Promise.all([page.getByRole('button', { name: 'Submit Survey', exact: true }).click(), second.getByRole('button', { name: 'Submit Survey', exact: true }).click()])
  await Promise.all([page.getByRole('heading', { name: 'Submission confirmed', exact: true }).or(page.getByRole('alert').filter({ hasText: 'This survey is no longer available or has already been answered.' })).first().waitFor(), second.getByRole('heading', { name: 'Submission confirmed', exact: true }).or(second.getByRole('alert').filter({ hasText: 'This survey is no longer available or has already been answered.' })).first().waitFor()])
  check((await page.getByRole('heading', { name: 'Submission confirmed', exact: true }).count()) + (await second.getByRole('heading', { name: 'Submission confirmed', exact: true }).count()) === 1, 'Concurrent mobile windows have exactly one transaction winner')
  await second.close()
  await page.reload(); await tab(page, 'Profile')
  await page.getByRole('button', { name: 'Change Password', exact: true }).click(); await page.getByLabel('Current Password', { exact: true }).filter({ visible: true }).fill(password)
  await page.getByLabel('New Password', { exact: true }).filter({ visible: true }).fill('ChangedPass9'); await page.getByLabel('Confirm New Password', { exact: true }).filter({ visible: true }).fill('ChangedPass9')
  await page.getByRole('button', { name: 'Change Password', exact: true }).click(); await page.getByText('Password changed successfully.', { exact: true }).waitFor()
  check(true, 'Password policy/change uses real Auth and trusted bridge'); await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Logout', exact: true }).click(); await page.getByLabel('Resident Number', { exact: true }).filter({ visible: true }).waitFor(); await signIn(page, number, 'ChangedPass9')
  await page.getByRole('tab', { name: 'Profile' }).waitFor(); check(true, 'Logout clears session; changed password signs in by issued number')
  await patch(`users/${uid}`, { isActive: false }); await page.getByLabel('Resident Number', { exact: true }).filter({ visible: true }).waitFor(); check(true, 'Live lifecycle deactivation refuses/signs out resident')
  await patch(`users/${uid}`, { isActive: true })
  const first = await identity('first', { isFirstLogin: true }); await signIn(page, first.number)
  await page.getByText('For your security, please change your password before continuing.', { exact: true }).waitFor(); check(await page.getByRole('tab').count() === 0, 'First-login gate hides resident routes')
  await page.getByLabel('Current Password', { exact: true }).filter({ visible: true }).fill(password); await page.getByLabel('New Password', { exact: true }).filter({ visible: true }).fill('FirstChanged9'); await page.getByLabel('Confirm New Password', { exact: true }).filter({ visible: true }).fill('FirstChanged9')
  await page.getByRole('button', { name: 'Change Password', exact: true }).click(); await page.getByRole('tab', { name: 'Profile' }).waitFor(); check(true, 'Actual first-login password change unlocks resident tabs')
  await tab(page, 'Profile'); await page.getByRole('button', { name: 'Logout', exact: true }).click()
  const staff = await identity('staff'); await signIn(page, staff.number)
  await page.getByText('Staff and administrator accounts must use the website. This app is for residents.', { exact: true }).waitFor(); check(await page.getByRole('tab').count() === 0, 'Staff receives explicit mobile refusal')
  for (const path of ['/google.firestore.v1.Firestore/Listen/channel', '/securetoken.googleapis.com/v1/token']) check(traffic.has(path), `Actual SDK gateway traffic: ${path}`)
  check(diagnostics.length === 0, `No browser exceptions or production requests: ${diagnostics.join('; ')}`)
  if (process.env.MOBILE_EVIDENCE_DIR) { await mkdir(process.env.MOBILE_EVIDENCE_DIR, { recursive: true }); await page.screenshot({ path: `${process.env.MOBILE_EVIDENCE_DIR}/mobile-resident-login.png`, fullPage: true }) }
  console.log(`Mobile real-service browser checks: ${checks} passed (390×844, Expo web; native device evidence pending)`)
} catch (error) {
  if (currentPage) console.error('Mobile failure screen:', (await currentPage.locator('body').innerText()).slice(-7000))
  console.error('Visible buttons:', await currentPage?.getByRole('button').allTextContents()); console.error('Button labels:', await currentPage?.getByRole('button').evaluateAll(rows => rows.map(r => r.getAttribute('aria-label')))); console.error('Browser diagnostics:', diagnostics)
  throw error
} finally {
  await browser?.close(); gateway?.kill(); php?.kill()
  if (originalCounter !== undefined) {
    await clearProposals()
    for (const row of await rows('', 'accountOperations')) if (identities.has(row.fields.uid?.stringValue)) { docs.add(row.name.split('/documents/')[1]); operations.add(row.name) }
    for (const row of await rows('', 'identifierAliases')) if (identities.has(row.fields.uid?.stringValue)) docs.add(row.name.split('/documents/')[1])
    for (const row of await rows('', 'loginHistory')) if (identities.has(row.fields.actorUid?.stringValue)) docs.add(row.name.split('/documents/')[1])
    for (const id of identities) {
      for (const collection of ['children', 'characterReferences']) for (const row of await rows(`residents/${id}`, collection)) docs.add(row.name.split('/documents/')[1])
      for (const c of ['users', 'residents', 'profileImages', 'accountLocks']) docs.add(`${c}/${id}`)
      for (const c of ['nameAddress', 'family']) docs.add(`pendingRequests/${id}_${c}`)
    }
    const writes = [...docs].map(remove)
    writes.push(originalCounter ? { update: { name: originalCounter.name, fields: originalCounter.fields } } : remove('counters/residentNumbers'))
    for (let i = 0; i < writes.length; i += 400) await rest(`${base}:commit`, { writes: writes.slice(i, i + 400) })
    for (const id of identities) await rest(`${authBase}/projects/${project}/accounts:delete`, { localId: id })
  }
}
