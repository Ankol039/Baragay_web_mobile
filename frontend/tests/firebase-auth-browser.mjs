import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'

// No real credentials, migration exports, database bootstrap or emulator-wide reset.
Object.assign(process.env, emulatorEnv)
const f = await import('./firestore-fixtures.mjs')
const { base, call, commit, write, remove, user, residentProfile, staffProfile } = f
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const app = 'http://127.0.0.1:5173/barangay_survey_system/app/'
const tag = randomUUID().slice(0, 8), docs = new Set(), accounts = {}, diagnostics = []
let browser, dev, checks = 0
function check(condition, label) { assert(condition, label); checks++ }
async function rest(url, token, body, method) {
  const result = await call(url, token, body, method)
  assert(result.ok, `Emulator operation failed (${result.status})`)
  return result.body
}
async function seed(path, data) {
  await rest(`${base}:commit`, 'owner', { writes: [{ ...write(path, data), currentDocument: { exists: false } }] })
  docs.add(path)
}
async function create(role, extra = {}, disabled = false) {
  const uid = `auth-test-${tag}-${role}`, resident = role.toLowerCase().includes('resident')
  const actualRole = resident ? 'resident' : role.toLowerCase().includes('admin') ? 'admin' : 'staff'
  const identifier = `${resident ? 'R' : 'S'}-2026-${String(Object.keys(accounts).length + 8100)}`
  const username = `fixture.${tag}.${role}`, email = `${username}@barangay.app`, password = 'FixturePass8'
  await rest(`${authBase}/projects/${project}/accounts`, 'owner', { localId: uid, email, password, disabled })
  accounts[role] = { uid, identifier, username, email, password }
  const account = user(uid, actualRole, { identifier, username: resident ? '' : username, ...extra })
  const profile = resident ? residentProfile(uid) : staffProfile(uid)
  if (!resident) profile.createdByUid = null
  await seed(`users/${uid}`, account)
  await seed(`${resident ? 'residents' : 'staff'}/${uid}`, profile)
  for (const [kind, value] of [[resident ? 'residentNumber' : 'staffNumber', identifier], ...(!resident ? [['username', username]] : [])]) {
    const normalizedIdentifier = value.toLowerCase()
    await seed(`identifierAliases/${kind}_${createHash('sha256').update(normalizedIdentifier).digest('hex')}`,
      { kind, normalizedIdentifier, uid, authEmail: email, createdAt: new Date() })
  }
  accounts[role] = { uid, identifier, username, email, password, profile }
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Local auth dev server did not become ready')
}
async function pageFor() {
  const context = await browser.newContext()
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => {
    diagnostics.push('Attempted live Firebase request')
    return route.abort()
  })
  // Auth is live; unconverted data endpoints are outside this suite. Prevent
  // their legacy db.php initialization from touching the real XAMPP database.
  await context.route(url => url.pathname.startsWith('/api/'), route => {
    if (new URL(route.request().url()).pathname.startsWith('/api/firebase/')) return route.continue()
    return route.fulfill({ status: 401, contentType: 'application/json',
      body: JSON.stringify({ ok: false, message: 'Please sign in to continue.' }) })
  })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (/^\/api\/(session|login|logout|change-password)$/.test(url.pathname)) diagnostics.push('Attempted legacy auth call')
  })
  await page.goto(app + 'login')
  await page.locator('#identifier').waitFor()
  return page
}
async function signIn(page, identifier, password = 'FixturePass8') {
  await page.locator('#identifier').fill(identifier)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
}
async function signOut(page) {
  await page.locator('#account-chip').click()
  await page.locator('#account-menu').getByRole('link', { name: 'Logout', exact: true }).click()
  await page.waitForURL(app + 'landing')
  check(true, 'SDK sign-out returns to landing')
}
async function change(page, current, password, confirmation = password) {
  await page.locator('#current_password').fill(current)
  await page.locator('#new_password').fill(password)
  await page.locator('#confirm_password').fill(confirmation)
  await page.locator('form button[type="submit"]').click()
}
async function history(uid) {
  const result = await rest(`${base}:runQuery`, 'owner', { structuredQuery: {
    from: [{ collectionId: 'loginHistory' }], where: { fieldFilter: { field: { fieldPath: 'actorUid' }, op: 'EQUAL', value: { stringValue: uid } } },
  } })
  return result.filter(row => row.document).map(row => {
    const document = row.document
    docs.add(`loginHistory/${document.name.split('/').at(-1)}`)
    return Object.fromEntries(Object.entries(document.fields).map(([key, value]) => [key, Object.values(value)[0]]))
  })
}
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Existing local suite is running')
  for (const role of ['resident', 'staff', 'admin']) await create(role)
  for (const role of ['firstResident', 'firstStaff', 'firstAdmin']) await create(role, { isFirstLogin: true, profileCompleted: role !== 'firstStaff' })
  await create('inactiveResident', { isActive: false }, true)
  await create('inactiveStaff', { isActive: false }, true)
  await create('archivedResident', { deletedAt: new Date() }, true)
  dev = startAuthDev()
  await ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')
  await ready(app)
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  for (const [role, alias] of [['resident', 'identifier'], ['staff', 'identifier'], ['staff', 'username'], ['admin', 'username'], ['admin', 'identifier']]) {
    console.log(`Checking ${role} ${alias}, guards, persistence and logout`)
    const account = accounts[role], page = await pageFor()
    check(await page.getByRole('tab').count() === 0 && await page.locator('form').count() === 1, 'Single form without tabs')
    await signIn(page, ` ${account[alias].toUpperCase()} `)
    const portal = role === 'resident' ? 'resident' : 'staff'
    await page.waitForURL(app + `${portal}/dashboard`)
    await page.locator('#app-sidebar').waitFor()
    check(await page.locator('#app-sidebar').count() === 1, 'Ready account has navigation')
    await page.reload()
    await page.locator('#account-chip').waitFor()
    check(page.url().endsWith(`${portal}/dashboard`), 'Firebase session survives reload')
    await page.goto(app + (portal === 'resident' ? 'staff/dashboard' : 'resident/dashboard'))
    await page.waitForURL(app + `${portal}/dashboard`)
    check(true, 'Cross-portal route guard preserves identity')
    if (role === 'staff') {
      await page.goto(app + 'staff/deleted-accounts')
      await page.getByText('Access denied. Only Admin accounts can manage staff accounts.').waitFor()
      check(true, 'Staff denied admin routes')
    } else if (role === 'admin') {
      await page.goto(app + 'staff/deleted-accounts')
      await page.locator('#account-chip').waitFor()
      check(await page.getByText('Access denied. Only Admin accounts can manage staff accounts.').count() === 0, 'Admin allowed admin routes')
    }
    await signOut(page)
    await page.goto(app + `${portal}/dashboard`)
    await page.waitForURL(app + 'landing')
    const events = await history(account.uid)
    check(events.filter(x => x.event === 'login').length === events.filter(x => x.event === 'logout').length, 'Trusted login/logout history paired')
    check(events.every(x => x.accountRole === (role === 'resident' ? 'Permanent Resident' : role === 'admin' ? 'Admin' : 'Staff') && x.at && x.ipAddress), 'Trusted role/time/IP fields')
    await page.context().close()
  }
  for (const role of ['firstResident', 'firstStaff', 'firstAdmin']) {
    console.log(`Checking ${role} password change`)
    const account = accounts[role], portal = role === 'firstResident' ? 'resident' : 'staff', page = await pageFor()
    await signIn(page, account.identifier)
    await page.waitForURL(app + `${portal}/change-password`)
    await page.locator('#new_password').waitFor()
    check(await page.locator('#password-rules li').count() === 5, 'Original password checklist')
    check(await page.locator('#app-sidebar').count() === 0, 'First login hides navigation')
    const signed = await rest(`${authBase}/accounts:signInWithPassword?key=emulator-only`, null,
      { email: account.email, password: account.password, returnSecureToken: true })
    for (const [password, expected] of [
      ['short', 'Your new password does not meet the requirements: At least 8 characters long; One uppercase letter (A-Z); One number (0-9).'],
      [account.password, 'Your new password must be different from your current one.'],
      ...(portal === 'staff' ? [[account.identifier, 'Your new password cannot be your Staff Number. That is the temporary password printed on your hand-over slip.']] : []),
    ]) {
      const response = await fetch('http://127.0.0.1:8787/api/firebase/index.php?action=password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          idToken: signed.idToken, current_password: account.password, new_password: password, confirm_password: password,
        }),
      })
      const result = await response.json()
      check(response.status === 422 && result.message === expected, 'Server enforces original password policy and order')
    }
    const forgedFlag = await commit(signed.idToken, [{ update: { name: write(`users/${account.uid}`, {}).update.name,
      fields: { isFirstLogin: { booleanValue: false } } }, updateMask: { fieldPaths: ['isFirstLogin'] } }])
    check(forgedFlag.status === 403, 'Client cannot clear first-login flag')
    const forgedHistory = await commit(signed.idToken, [write(`loginHistory/forged-${tag}`, { actorUid: account.uid })])
    check(forgedHistory.status === 403, 'Client cannot forge audit history')
    await page.goto(app + `${portal}/dashboard`)
    await page.waitForURL(app + `${portal}/change-password`)
    await change(page, 'WrongCurrent8', 'NewFixture9')
    await page.getByText('Current password is incorrect.', { exact: true }).waitFor()
    check(await page.locator('#current_password').inputValue() === '', 'Password failure clears fields')
    await change(page, account.password, 'NewFixture9', 'OtherFixture9')
    await page.getByText('New password and confirmation do not match.', { exact: true }).waitFor()
    const flagBefore = await rest(`${base}/users/${account.uid}`, 'owner')
    check(flagBefore.fields.isFirstLogin.booleanValue, 'Failed change does not clear first-login')
    await change(page, account.password, 'NewFixture9')
    if (role === 'firstStaff') {
      await page.waitForURL(app + 'staff/complete-profile')
      await page.waitForFunction(() => !document.querySelector('#app-sidebar'))
      check(await page.locator('#app-sidebar').count() === 0, 'Staff onboarding still hides navigation')
      await page.goto(app + 'staff/dashboard')
      await page.waitForURL(app + 'staff/complete-profile')
      check(true, 'Staff onboarding gate remains after password change')
    } else {
      await page.locator('#password-success-modal.active').waitFor()
      check(await page.getByText('Your account is now set up. Use your new password the next time you log in.').count() === 1, 'Original first-login success message')
      await page.getByRole('button', { name: 'Stay Here', exact: true }).click()
    }
    const flagAfter = await rest(`${base}/users/${account.uid}`, 'owner')
    check(!flagAfter.fields.isFirstLogin.booleanValue, 'Trusted bridge clears first-login after Auth change')
    const failed = await call(`${authBase}/accounts:signInWithPassword?key=emulator-only`, null, { email: account.email, password: account.password, returnSecureToken: true })
    check(!failed.ok, 'Old password rejected by Firebase Auth')
    await signOut(page)
    await page.goto(app + 'login')
    await signIn(page, account.identifier, 'NewFixture9')
    await page.waitForURL(app + (role === 'firstStaff' ? 'staff/complete-profile' : `${portal}/dashboard`))
    check(true, 'New password signs in without password gate')
    await signOut(page)
    await page.context().close()
  }
  for (const [role, password, message] of [
    ['resident', 'WrongFixture9', 'Invalid username/Resident Number or password.'],
    ['inactiveResident', 'FixturePass8', 'This account has been deactivated. Please contact the Barangay Health Center.'],
    ['inactiveStaff', 'FixturePass8', 'This account has been deactivated. Please contact the administrator.'],
    ['archivedResident', 'FixturePass8', 'Invalid username/Resident Number or password.'],
  ]) {
    const page = await pageFor()
    await signIn(page, accounts[role].identifier, password)
    await page.getByText(message, { exact: true }).waitFor()
    check(await page.locator('#password').inputValue() === '', 'Refused credentials clear password')
    await page.context().close()
  }
  const page = await pageFor()
  await signIn(page, '', '')
  await page.getByText('Please enter your username or Resident Number and password.', { exact: true }).waitFor()
  check(true, 'Original empty-credentials message')
  await signIn(page, 'R-2026-000', 'WrongFixture9')
  await page.getByText('Invalid username/Resident Number or password.', { exact: true }).waitFor()
  check(true, 'Malformed identifier does not fall back to a resident')
  // Live lifecycle listener: disable a signed-in resident and observe local sign-out.
  await signIn(page, accounts.resident.identifier)
  await page.waitForURL(app + 'resident/dashboard')
  await page.locator('#account-chip').waitFor()
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
    return canvas.toDataURL('image/jpeg').split(',')[1]
  })
  await seed(`profileImages/${accounts.resident.uid}`, { ownerUid: accounts.resident.uid, mimeType: 'image/jpeg', base64: image, updatedAt: new Date() })
  await page.reload()
  await page.waitForFunction(() => document.querySelector('#account-chip img')?.naturalWidth === 1)
  check(true, 'Firestore compressed avatar renders in unchanged account chip')
  await page.setViewportSize({ width: 390, height: 844 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Auth shell fits mobile viewport')
  const saved = await rest(`${base}/users/${accounts.resident.uid}`, 'owner')
  await rest(`${base}:commit`, 'owner', { writes: [{ update: { name: saved.name, fields: { isActive: { booleanValue: false } } }, updateMask: { fieldPaths: ['isActive'] } }] })
  await page.waitForURL(app + 'landing')
  check(true, 'Deactivation invalidates a live app session')
  const events = await history(accounts.resident.uid)
  check(events.filter(x => x.event === 'login').length === events.filter(x => x.event === 'logout').length, 'Lifecycle sign-out writes logout history')
  assert.deepEqual(diagnostics, [], 'No runtime errors, live Firebase requests or legacy auth calls')
  console.log(`PASS: ${checks} Firebase auth browser checks; resident, staff, admin, aliases, first login, history, guards, persistence and refusals.`)
} finally {
  await browser?.close()
  dev?.stop()
  // Discover every event owned by these synthetic UIDs, even on an assertion failure.
  for (const account of Object.values(accounts)) {
    await history(account.uid)
    await rest(`${authBase}/projects/${project}/accounts:delete`, 'owner', { localId: account.uid })
  }
  if (docs.size) {
    const result = await commit('owner', [...docs].map(remove))
    assert(result.ok, 'Synthetic fixture cleanup failed')
  }
}
