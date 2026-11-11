import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'
import { emulatorEnv, project } from '../scripts/auth-dev.mjs'
import { startFirebaseRuntime } from '../scripts/firebase-runtime.mjs'

Object.assign(process.env, emulatorEnv)
const { base, call, commit, write, remove, user, residentProfile } = await import('./firestore-fixtures.mjs')
const runtime = 'http://127.0.0.1:8797'
const auth = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const uid = `runtime-${randomUUID()}`, email = `${uid}@example.invalid`, password = 'FixturePass8'
// Alias seeding refuses collisions rather than overwriting an issued account.
const identifier = 'R-2026-9998', normalized = identifier.toLowerCase()
const alias = `identifierAliases/residentNumber_${createHash('sha256').update(normalized).digest('hex')}`
const documents = new Set()
let server, browser, checks = 0, identityCreated = false
const check = (condition, message) => { assert(condition, message); checks++ }
async function seed(path, data) {
  const result = await commit('owner', [{ ...write(path, data), currentDocument: { exists: false } }])
  check(result.ok, 'Fixture created without overwriting data'); documents.add(path)
}
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Local emulators available')
  const created = await call(`${auth}/projects/${project}/accounts`, 'owner', { localId: uid, email, password })
  check(created.ok, 'Synthetic Auth identity created'); identityCreated = true
  await seed(`users/${uid}`, user(uid, 'resident', { identifier }))
  await seed(`residents/${uid}`, residentProfile(uid))
  await seed(alias, { kind: 'residentNumber', normalizedIdentifier: normalized, uid, authEmail: email, createdAt: new Date() })
  server = startFirebaseRuntime(8797)
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Standalone runtime exited before readiness')
    try { ready = (await fetch(runtime)).ok } catch { /* starting */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  check(ready, 'Built application served without Apache or Vite')
  for (const path of ['/config/db.php', '/config/functions.php', '/.env', '/.git/config', '/migration/out/export.json',
    '/api/index.php', '/api/firebase/transport.php', '/api/firebase/router.php', '/firebase-unknown.php', '/missing.js',
    '/%2e%2e/config/db.php', '/assets/%252e%252e/config/db.php']) {
    check((await fetch(runtime + path)).status === 404, `Private or unknown path denied: ${path}`)
  }
  const policy = await fetch(`${runtime}/firebase-auth.php?action=rules`)
  check(policy.ok && (await policy.json()).ok, 'Build API wrapper reaches only the trusted endpoint')
  check((await fetch(`${runtime}/api/firebase/index.php?action=rules`)).ok, 'Canonical API path works')
  check((await fetch(`${runtime}/assets/missing.js`, { method: 'POST' })).status === 405, 'Static write method denied')
  const failures = []
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage()
  page.on('pageerror', error => failures.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { failures.push('Unexpected external request'); return route.abort() }
    if (url.hostname === 'localhost' || !['8797', '9099', '8080'].includes(url.port)) {
      failures.push('Unexpected legacy or runtime request'); return route.abort()
    }
    return route.continue()
  })
  await page.goto(`${runtime}/login`)
  await page.locator('#identifier').fill(identifier)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await page.waitForURL(`${runtime}/resident/dashboard`)
  await page.locator('#app-sidebar').waitFor()
  check(true, 'Built Firebase login and resident dashboard work without legacy API')
  await page.reload(); await page.locator('#app-sidebar').waitFor()
  check(true, 'Built SPA deep-link reload and persisted session work')
  await page.goto(`${runtime}/resident/profile`)
  await page.getByRole('heading', { name: 'My Profile', exact: true }).waitFor()
  await page.getByText('Profile Photo', { exact: true }).waitFor()
  check(true, 'Built profile reads pass through the standalone API')
  await page.locator('#account-chip').click()
  await page.locator('#account-menu').getByRole('link', { name: 'Logout', exact: true }).click()
  await page.waitForURL(`${runtime}/landing`)
  check(true, 'Built logout works')
  check(failures.length === 0, 'No browser errors, external Firebase requests or legacy dependency')
  console.log(`PASS: ${checks} standalone built-runtime checks; local synthetic Firebase data only.`)
} finally {
  await browser?.close()
  if (server && server.exitCode === null) {
    const stopped = new Promise(resolve => server.once('exit', resolve))
    server.kill(); await stopped
  }
  // Derive only this fixture's audit events; never reset the shared suite.
  if (identityCreated) {
    const history = await call(`${base}:runQuery`, 'owner', { structuredQuery: {
      from: [{ collectionId: 'loginHistory' }], where: { fieldFilter: {
        field: { fieldPath: 'actorUid' }, op: 'EQUAL', value: { stringValue: uid } } },
    } })
    assert(history.ok, 'Fixture audit cleanup query succeeded')
    for (const row of history.body) if (row.document) documents.add(`loginHistory/${row.document.name.split('/').at(-1)}`)
  }
  if (documents.size) assert((await commit('owner', [...documents].map(remove))).ok, 'Fixture documents removed')
  if (identityCreated) assert((await call(`${auth}/accounts:delete?key=emulator-only`, 'owner', { localId: uid })).ok, 'Fixture identity removed')
}
