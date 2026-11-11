import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { emulatorEnv, startAuthDev } from '../scripts/auth-dev.mjs'
import { connectionOptions } from '../../migration/src/mysql.mjs'

Object.assign(process.env, emulatorEnv)
const { base, call, commit, remove, write, survey, response, answer, day } = await import('./firestore-fixtures.mjs')
const app = 'http://127.0.0.1:5173/barangay_survey_system/app/'
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
let browser, dev, checks = 0, residents = 0, responseCount = 0
const restore = new Map(), diagnostics = [], seeded = []
const initialAuditPaths = new Set()
function check(value, label) { if (!value) throw new Error(label); checks++ }
async function rest(url, token, body) {
  const response = await call(url, token, body)
  check(response.ok, `Local operation failed (${response.status})`)
  return response.body
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Local dev server did not start')
}
async function service(page, name, argument) {
  return page.evaluate(async ({ name, argument }) => {
    const service = await import('/barangay_survey_system/app/src/services/residentService.js')
    return service[name](argument)
  }, { name, argument })
}
function matches(actual, expected, label) {
  let mismatch = ''
  function equal(a, b, path = '') {
    let match
    if (Array.isArray(b)) match = Array.isArray(a) && a.length === b.length && b.every((row, i) => equal(a[i], row, `${path}[]`))
    else if (b && typeof b === 'object') match = a && Object.keys(b).every(k => equal(a[k], b[k], `${path}.${k}`))
    else if (b === null) match = a === null
    else match = String(a) === String(b)
    if (!match && !mismatch) mismatch = path
    return match
  }
  check(equal(actual, expected), `${label}${mismatch ? ` (${mismatch})` : ''}`)
}
async function seed(path, data) {
  const result = await commit('owner', [{ ...write(path, data), currentDocument: { exists: false } }])
  check(result.ok, 'Synthetic boundary fixture collision-refusing create')
  seeded.push(path)
}
async function boundaryCases(page, uid, otherUid, token) {
  const tag = 'read-' + randomUUID().slice(0, 8), before = (await service(page, 'getResidentDashboard')).data
  const shifted = days => new Date(day.getTime() + days * 86400000)
  const fixtureSurvey = extra => survey({ createdByUid: 'staff-fixture', ...extra })
  for (let i = 0; i < 7; i++) await seed(`surveys/${tag}-${i}`, fixtureSurvey({ title: `Boundary ${i}`, endDate: shifted(i) }))
  await seed(`surveys/${tag}-future`, fixtureSurvey({ startDate: shifted(1), endDate: shifted(2) }))
  await seed(`surveys/${tag}-past`, fixtureSurvey({ startDate: shifted(-2), endDate: shifted(-1) }))
  await seed(`surveys/${tag}-inactive`, fixtureSurvey({ status: 'inactive' }))
  const sid = `${tag}-answered`, rid = `${sid}_${uid}`
  await seed(`surveys/${sid}`, fixtureSurvey({ title: 'Current title', description: 'Current description' }))
  await seed(`responses/${rid}`, response(uid, sid))
  const questions = [
    ['mc', 'multiple_choice', 1], ['rating', 'rating', 2], ['yes', 'yesno', 3], ['short', 'short_answer', 4],
    ['missing-choice', 'multiple_choice', 5], ['unanswered', 'short_answer', 6],
  ]
  for (const [id, type, order] of questions) {
    await seed(`surveys/${sid}/questions/${id}`, { text: `Current ${id}`, type, order, legacyId: null })
    if (id === 'unanswered') continue
    await seed(`responses/${rid}/answers/${id}`, answer(id, { type, order, questionText: 'Old question snapshot', rating: type === 'rating' ? 5 : null,
      choiceId: type === 'multiple_choice' ? 'choice' : null, choiceText: type === 'multiple_choice' ? 'Old choice snapshot' : '',
      text: type === 'yesno' ? 'Yes' : type === 'short_answer' ? 'No answer' : '' }))
  }
  await seed(`surveys/${sid}/questions/mc/choices/choice`, { text: 'Current choice', order: 1, legacyId: null })
  await seed(`responses/${rid}/answers/deleted-question`, answer('deleted-question'))
  if (otherUid) await seed(`responses/${tag}-0_${otherUid}`, response(otherUid, `${tag}-0`))
  const after = (await service(page, 'getResidentDashboard')).data
  check(after.available_count === before.available_count + 7, 'Inclusive start/end dates; inactive/past/future and own answered surveys excluded')
  check(after.answered_count === before.answered_count + 1, 'Dashboard counts only own responses')
  check(after.assigned_total === after.available_count + after.answered_count, 'Assigned headline preserves historical-completion scope')
  check(after.upcoming.length === 5 && after.upcoming.every((row, i, list) => !i || row.end_date >= list[i - 1].end_date), 'Closing-soon list sorted and capped at five')
  const list = (await service(page, 'getResidentSurveys')).data
  check(list.open.some(row => row.survey_id === `${tag}-0`), 'Another resident answer does not hide an available survey')
  check(list.answered.some(row => row.survey_id === sid) && !list.open.some(row => row.survey_id === sid), 'Own answered survey appears only in answered list')
  const detail = (await service(page, 'getResidentResponse', rid)).data
  check(detail.response.title === 'Current title' && detail.response.description === 'Current description', 'History uses current metadata, preserving PHP joins')
  matches(detail.answers.map(row => row.display_answer), ['Current choice', '5 / 5', 'Yes', 'No answer', 'No answer', 'No answer'], 'All answer types, missing choice and unanswered current question')
  check(detail.answers.length === 6 && detail.answers[0].question_text === 'Current mc', 'Removed questions excluded and current question ordering retained')
  matches((await service(page, 'getResidentSurveys', sid)).data.submitted, { title: 'Current title' }, 'Submitted modal title comes from Firestore')
  if (otherUid) {
    const foreign = `${tag}-0_${otherUid}`
    for (const path of [`responses/${foreign}`, `responses/${foreign}/answers/mc`]) check((await call(`${base}/${path}`, token)).status === 403, 'Direct SDK/REST foreign response and answers denied by rules')
  }
  // Closed survey retains owned history and current joins without opening definitions.
  await rest(`${base}:commit`, 'owner', { writes: [write(`surveys/${sid}`, fixtureSurvey({ title: 'Closed current title', description: 'Closed current description', status: 'inactive' }))] })
  check((await service(page, 'getResidentResponse', rid)).data.response.title === 'Closed current title', 'Closed owned response remains readable')
  check((await call(`${base}/surveys/${sid}`, token)).status === 403, 'Closed survey definition remains client-denied')
  const empty = await service(page, 'getResidentSurveys', `${tag}-not-found`)
  check(empty.data.submitted === null, 'Missing optional confirmation title is harmless')
  await commit('owner', seeded.splice(0).reverse().map(remove))
}
async function signIn(page, identifier) {
  await page.goto(app + 'login')
  await page.locator('#identifier').fill(identifier)
  await page.locator('#password').fill(identifier)
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await page.waitForURL(app + 'resident/dashboard')
  await page.locator('.db-strip').waitFor()
}
async function visit(page, route, selector) {
  await page.goto(app + route)
  await page.locator(selector).first().waitFor()
}
try {
  // Read-only PHP oracle runs exact existing API queries and DateTime/mb formatting.
  const options = await connectionOptions()
  const reference = JSON.parse(execFileSync(process.env.PHP_BINARY || '/Applications/XAMPP/xamppfiles/bin/php',
    ['../docs/tests/resident-firestore-reference.php'], { cwd: new URL('../', import.meta.url), encoding: 'utf8',
      env: { ...process.env, BSS_TEST_HOST: options.host, BSS_TEST_USER: options.user, BSS_TEST_PASSWORD: options.password,
        BSS_TEST_DATABASE: options.database, BSS_TEST_PORT: String(options.port) }, maxBuffer: 8 * 1024 * 1024 }))
  check(reference.length > 0, 'Read-only PHP resident reference available')
  const audit = await rest(`${base}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: 'loginHistory' }] } })
  for (const row of audit) if (row.document) initialAuditPaths.add(row.document.name)
  dev = startAuthDev()
  await Promise.all([ready('http://127.0.0.1:5173'), ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')])
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const otherResponse = reference.flatMap(row => row.history.data.responses.map(response => ({ ...response, owner: row.id })))
  for (const source of reference) {
    const uid = `resident-${source.id}`, account = await rest(`${base}/users/${uid}`, 'owner')
    restore.set(`users/${uid}`, account)
    // Emulate completed setup only locally, preserving/restoring the migrated flags.
    await rest(`${base}:commit`, 'owner', { writes: [{ update: { name: account.name, fields: { isFirstLogin: { booleanValue: false } } }, updateMask: { fieldPaths: ['isFirstLogin'] } }] })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    await context.addInitScript(() => { window.printCalls = 0; window.print = () => { window.printCalls++ } })
    await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Live Firebase attempt'); return route.abort() })
    await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/firebase/'), route => {
      diagnostics.push('Legacy data request'); return route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', () => diagnostics.push('Browser exception'))
    await signIn(page, account.fields.identifier.stringValue)
    const idMap = Object.fromEntries(source.history.data.responses.map(row => [row.response_id, `${row.survey_id}_${uid}`]))
    matches(await service(page, 'getResidentDashboard'), source.dashboard, 'Dashboard matches PHP figures, address, household and monthly activity')
    matches(await service(page, 'getResidentSurveys'), source.surveys, 'Surveys list matches PHP open/answered partition')
    await visit(page, 'resident/surveys', '.card-head-title')
    check((await page.locator('.card-head-title').first().textContent()).includes(`(${source.surveys.data.open.length})`), 'Rendered available count matches PHP')
    for (const view of ['available', 'completed', 'assigned']) {
      matches(await service(page, 'getResidentStatDetail', view), source[view], `Stat ${view} matches PHP`)
      await visit(page, `resident/stat-detail?view=${view}`, '.detail-count strong')
      check(await page.locator('.detail-count strong').textContent() === String(source[view].data.count), `Rendered ${view} count matches PHP`)
    }
    matches(await service(page, 'getResidentHistory'), source.history, 'History matches PHP titles, descriptions, dates and ordering')
    await visit(page, 'resident/history', 'h1')
    check(await page.locator('tbody tr').count() === source.history.data.responses.length, 'Rendered history row count matches PHP')
    for (const [legacyId, expected] of Object.entries(source.responses)) {
      matches(await service(page, 'getResidentResponse', legacyId), expected, 'Response matches PHP question/choice joins and answer display')
      const canonical = idMap[legacyId]
      matches(await service(page, 'getResidentResponse', canonical), expected, 'Canonical response link retains legacy response parity')
      await visit(page, `resident/view-response?id=${canonical}&print=1`, '.response-print-card')
      await page.waitForFunction(() => window.printCalls === 1)
      check(await page.locator('.submitted-answer').count() === expected.data.answers.length, 'Print renders every current question')
      await page.getByRole('button', { name: 'Print response', exact: true }).click()
      check(await page.evaluate(() => window.printCalls) === 2, 'Manual print invokes browser print')
      await page.emulateMedia({ media: 'print' })
      check(await page.locator('.report-actions').evaluate(node => getComputedStyle(node).display) === 'none', 'Print controls hidden by existing CSS')
      await page.emulateMedia({ media: 'screen' })
      const downloaded = page.waitForEvent('download')
      await page.getByRole('link', { name: 'Download CSV' }).click()
      const download = await downloaded, csv = await readFile(await download.path(), 'utf8')
      const direct = await service(page, 'getResidentResponseCsv', canonical)
      check(csv === direct.csv && download.suggestedFilename() === direct.filename, 'CSV download uses authorized Firestore data')
      check(csv === source.csv[legacyId] && direct.filename === `survey-response-${legacyId}.csv`, 'CSV bytes and filename match original PHP')
      responseCount++
    }
    const foreign = otherResponse.find(row => row.owner !== source.id)
    for (const id of ['does-not-exist', 'null', ...(foreign ? [String(foreign.response_id), `${foreign.survey_id}_resident-${foreign.owner}`] : [])]) {
      check((await service(page, 'getResidentResponse', id)).redirect === '/resident/history', 'Invalid/foreign response redirects to history')
    }
    const signed = await rest(`${authBase}/accounts:signInWithPassword?key=emulator-only`, null,
      { email: `r-${account.fields.identifier.stringValue.slice(2).toLowerCase()}@barangay.app`, password: account.fields.identifier.stringValue, returnSecureToken: true })
    if (foreign) {
      const r = await fetch('http://127.0.0.1:8787/api/firebase/resident-read.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'response', idToken: signed.idToken, responseId: `${foreign.survey_id}_resident-${foreign.owner}`, residentUid: `resident-${foreign.owner}` }) })
      check(r.ok && (await r.json()).data === null, 'Bridge ignores forged owner and denies foreign metadata')
    }
    if (!residents) await boundaryCases(page, uid, foreign ? `resident-${foreign.owner}` : null, signed.idToken)
    await page.setViewportSize({ width: 390, height: 844 })
    await visit(page, 'resident/dashboard', '.db-strip')
    check(await page.locator('.db-strip').isVisible(), 'Mobile dashboard renders migrated figures')
    check((await service(page, 'getResidentStatDetail', 'unknown')).redirect === '/resident/dashboard', 'Invalid stat whitelist redirects')
    await context.close()
    residents++
  }
  check(diagnostics.length === 0, 'No legacy data calls, live Firebase requests or browser exceptions')
  const report = `# Resident Firestore verification — Phase 2 Prompt 5\n\nEmulator-only check on ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.\n\n- ${residents} migrated active residents compared against the existing PHP/MySQL handlers in a read-only transaction.\n- ${responseCount} responses matched current question/choice joins, answer text and missing-answer behavior.\n- Dashboard counts, six-month activity, closing-soon/deadline figures, household, address and residency values matched.\n- Surveys partition, all three stat views and history matched; print and CSV download exercised in Chrome.\n- ${checks} checks passed; no legacy MySQL HTTP calls, production Firebase requests or browser exceptions.\n- Migrated lifecycle flags restored and test login audit events removed; emulator suite left running.\n\nNo source account names, identifiers, contacts, answers or credentials are included in this report.\n`
  await writeFile(new URL('../../docs/resident-firestore-verification.md', import.meta.url), report)
  console.log(`PASS: ${checks} checks; ${residents} migrated residents; ${responseCount} responses; zero browser/legacy/production diagnostics.`)
} catch (error) {
  console.error(`Resident Firestore check failed: ${error.message.split('\n')[0]}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  for (const [path, document] of restore) {
    await rest(`${base}:commit`, 'owner', { writes: [{ update: { name: document.name, fields: document.fields } }] })
    // Only this test's auth login operation uses these accounts during the run.
    const uid = path.split('/')[1]
    const events = await rest(`${base}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: 'loginHistory' }], where: { fieldFilter: {
      field: { fieldPath: 'actorUid' }, op: 'EQUAL', value: { stringValue: uid } } } } })
    const synthetic = events.filter(row => row.document?.name.split('/').at(-1).startsWith('auth_') && !initialAuditPaths.has(row.document.name))
    if (synthetic.length) await commit('owner', synthetic.map(row => remove(`loginHistory/${row.document.name.split('/').at(-1)}`)))
  }
  if (seeded.length) await commit('owner', seeded.map(remove))
  dev?.stop()
}
