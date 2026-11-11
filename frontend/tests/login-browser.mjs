/** Live XAMPP + Vite regression. Supply PLAYWRIGHT_MODULE_PATH if Playwright is installed elsewhere. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const php = process.env.PHP_BINARY || '/Applications/XAMPP/xamppfiles/bin/php'
const fixtures = fileURLToPath(new URL('../../docs/tests/login-fixtures.php', import.meta.url))
const app = process.env.LOGIN_APP_URL || 'http://localhost:5173/barangay_survey_system/app/'
const origin = new URL(app).origin
const temp = mkdtempSync(join(tmpdir(), 'barangay-single-login-'))
const registry = join(temp, 'accounts.json')
const generic = 'Invalid username/Resident Number or password.'
const diagnostics = []
let browser, checks = 0

function check(ok, label) { assert(ok, label); checks++ }
try {
  execFileSync(php, [fixtures, 'create', registry], { stdio: 'pipe' })
  const state = JSON.parse(readFileSync(registry, 'utf8'))
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
  for (const [role, identifier, query] of [
    ['resident', state.accounts.resident.number, ''],
    ['resident', state.accounts.resident.number.toLowerCase(), '?portal=staff'],
    ['resident', ` ${state.accounts.resident.number} `, '?portal=admin'],
    ['staff', state.accounts.staff.number, '?portal=resident'],
    ['staff', ` ${state.accounts.staff.number.toLowerCase()} `, ''],
    ['staff', state.accounts.staff.username, ''],
    ['admin', state.accounts.admin.username, '?portal=resident'],
    ['admin', state.accounts.admin.username.toUpperCase(), ''],
  ]) {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => diagnostics.push(error.message))
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) diagnostics.push(msg.text()) })
    page.on('requestfailed', req => { if (!req.failure()?.errorText.includes('ERR_ABORTED')) diagnostics.push(req.url()) })
    await page.goto(app + 'login' + query)
    const field = page.getByLabel('Resident No. / Staff No. / Username')
    await field.waitFor()
    check(await page.getByRole('tab').count() === 0 && await page.getByRole('tablist').count() === 0, 'No tabs')
    check(await page.locator('form').count() === 1, 'Single form')
    check(await page.getByRole('link', { name: /Switch to/ }).count() === 0, 'No switch links')
    check(await field.getAttribute('placeholder') === 'e.g. R-2026-0001, S-2026-0001 or admin', 'Shared placeholder')
    check(await page.locator('.auth-form-hint').textContent() === 'Enter your Resident Number, Staff Number or username.', 'Shared helper')
    check(await page.locator('.auth-recovery').textContent().then(text => text.includes('Forgot your password?')), 'Recovery note retained')
    await field.fill(identifier)
    await page.locator('#password').fill(state.accounts[role].password)
    await page.getByRole('button', { name: 'Show password', exact: true }).click()
    check(await page.locator('#password').getAttribute('type') === 'text', 'Password shown')
    await page.getByRole('button', { name: 'Hide password', exact: true }).click()
    check(await page.locator('#password').getAttribute('type') === 'password', 'Password hidden')
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/login' && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Log In', exact: true }).click()
    const login = await response
    check(login.status() === 200, 'Live form login succeeded')
    const payload = login.request().postDataJSON()
    check(Object.keys(payload).sort().join(',') === 'identifier,password', 'Client sends only credentials')
    check(payload.identifier === (identifier.trim().match(/^[RS]-/i) ? identifier.trim().toUpperCase() : identifier.trim()), 'ID normalised')
    const portal = role === 'resident' ? 'resident' : 'staff'
    await page.waitForURL(app + `${portal}/dashboard`)
    await page.locator('#app-sidebar').waitFor()
    check((await login.json()).data.user.role === role, 'Correct server role and dashboard')
    await page.locator('#account-chip').click()
    await page.locator('#account-menu').getByRole('link', { name: 'Logout', exact: true }).click()
    await page.waitForURL(app + 'landing')
    check((await (await context.request.get(origin + '/api/session')).json()).data.user === null, 'Logout clears identity')
    await context.close()
  }
  // Direct API calls bypass all frontend detection, including forged client type hints.
  for (const [identifier, password, succeeds] of [
    [state.accounts.resident.number.toLowerCase(), state.accounts.resident.password, true],
    [` ${state.accounts.staff.number.toLowerCase()} `, state.accounts.staff.password, true],
    [state.accounts.resident.number, state.accounts.staff.password, false],
    ['R-2026-001', state.accounts.resident.password, false],
    ['missing.login.fixture', state.accounts.staff.password, false],
  ]) {
    const context = await browser.newContext()
    const before = await context.request.get(origin + '/api/session')
    check(before.status() === 200, 'Anonymous session available')
    const cookiesBefore = await context.cookies()
    const response = await context.request.post(origin + '/api/login', {
      data: { identifier, password, account_type: 'admin', portal: 'staff' },
    })
    const body = await response.json()
    if (succeeds) {
      check(response.status() === 200 && body.data.authenticated, 'Server detects and normalises raw credentials')
      const cookiesAfter = await context.cookies()
      check(cookiesBefore.some(old => cookiesAfter.some(next => old.name === next.name && old.value !== next.value)), 'Live session regenerated')
      await context.request.post(origin + '/api/logout')
    } else {
      check(response.status() === 401 && body.message === generic, 'Generic invalid ID/password error')
      check((await (await context.request.get(origin + '/api/session')).json()).data.user === null, 'Failure remains anonymous')
    }
    await context.close()
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    await page.goto(app + 'login?portal=staff')
    await page.locator('#identifier').fill(state.accounts.staff.username)
    await page.locator('#password').fill('WrongPasswordA1')
    await page.getByRole('button', { name: 'Log In', exact: true }).click()
    await page.getByRole('alert').waitFor()
    check(await page.getByRole('alert').textContent() === generic, 'Same visible wrong-password message')
    check(await page.locator('#password').inputValue() === '', 'Failed password cleared')
    check(await page.locator('#identifier').inputValue() === state.accounts.staff.username, 'Identifier retained')
    check(await page.getByRole('tab').count() === 0, 'No tabs after error')
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Layout fits viewport')
    await context.close()
  }
  assert.deepEqual(diagnostics, [])
  console.log(`PASS: ${checks} live browser/API checks, resident/staff number/staff username/admin, desktop/mobile, zero unexpected diagnostics.`)
} finally {
  await browser?.close()
  if (existsSync(registry)) {
    process.stdout.write(execFileSync(php, [fixtures, 'clean', registry], { encoding: 'utf8' }))
  }
  rmSync(temp, { recursive: true, force: true })
}
