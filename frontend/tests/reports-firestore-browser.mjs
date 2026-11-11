import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
const { user, residentProfile, staffProfile, survey, day } = await import('./firestore-fixtures.mjs')
const require = createRequire(new URL('../../migration/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const admin = initializeApp({ projectId: project }, 'reports-local-test'), db = getFirestore(admin), auth = getAuth(admin)
const app = 'http://127.0.0.1:5173/barangay_survey_system/app/', endpoint = 'http://127.0.0.1:8787/api/firebase/staff-reports.php'
const tag = `reports-${randomUUID().slice(0, 8)}`, password = 'FixturePass8', tokens = {}, identities = [], diagnostics = [], owned = new Set()
let browser, dev, checks = 0
const check = (condition, label) => { assert(condition, label); checks++ }
// Never include migrated personal data in assertion output; evidence is labels/counts only.
const equal = (actual, expected, label) => { assert(isDeepStrictEqual(actual, expected), label); checks++ }
async function snapshot() {
  const result = new Map()
  async function walk(parent) {
    for (const collection of await parent.listCollections()) for (const ref of await collection.listDocuments()) {
      const doc = await ref.get(); if (doc.exists) result.set(ref.path, doc.data()); await walk(ref)
    }
  }
  await walk(db); return result
}
async function seed(entries) {
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch(); entries.slice(i, i + 400).forEach(([path, data]) => { owned.add(path); batch.create(db.doc(path), data) }); await batch.commit()
  }
}
async function api(action, values = {}, role = 'staff') {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, action, idToken: tokens[role] || '' }) })
  return { status: r.status, ...await r.json() }
}
async function ready(url) {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  throw new Error('Reports local runtime did not start')
}
async function signedPage(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Production request'); return route.abort() })
  await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/firebase/'), route => { diagnostics.push('Legacy request'); return route.abort() })
  const page = await context.newPage(); page.on('pageerror', error => diagnostics.push(error.message))
  await page.goto(app + 'login')
  await page.evaluate(async ({ email, password }) => {
    const { getFirebase } = await import('/barangay_survey_system/app/src/services/firebase.js')
    const { signInWithEmailAndPassword } = await import('/barangay_survey_system/app/node_modules/.vite/deps/firebase_auth.js')
    await signInWithEmailAndPassword(getFirebase().auth, email, password)
  }, { email: `${tag}-${role}@example.invalid`, password })
  return page
}
const sid = `${tag}-closed`, empty = `${tag}-empty`, open = `${tag}-open`, future = `${tag}-future`
const original = await snapshot(), originalAuth = (await auth.listUsers(1000)).users.map(u => u.uid).sort()
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Shared emulators available')
  for (const role of ['staff', 'admin', 'resident', 'inactive', 'archived', 'first', 'onboarding', 'unprovisioned']) {
    const uid = `${tag}-${role}`, email = `${uid}@example.invalid`
    await auth.createUser({ uid, email, password }); identities.push(uid)
    const kind = role === 'resident' ? 'resident' : role === 'admin' ? 'admin' : 'staff'
    const extra = role === 'first' ? { isFirstLogin: true } : role === 'onboarding' ? { profileCompleted: false } : role === 'inactive' ? { isActive: false } : role === 'archived' ? { deletedAt: day } : {}
    if (role !== 'unprovisioned') await seed([[`users/${uid}`, user(uid, kind, extra)], [`${kind === 'resident' ? 'residents' : 'staff'}/${uid}`, kind === 'resident' ? residentProfile(uid) : { ...staffProfile(uid), createdByUid: null }]])
    const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })
    check(login.ok, 'Synthetic emulator identity signs in'); tokens[role] = (await login.json()).idToken
  }
  const yesterday = new Date(day.getTime() - 86400000), tomorrow = new Date(day.getTime() + 86400000)
  const profiles = [
    ['alpha', { name: { firstName: 'Ava', lastName: 'Álpha', gender: 'woman' }, birthdate: new Date('2008-01-01'), household: { occupation: ' Nurse ', isMarried: true, hasChildren: false }, permanentAddress: { purok: 'Purok 1' }, specialCategory: 'pwd' }, {}],
    ['beta', { name: { firstName: 'Bea', lastName: 'Beta', gender: '' }, birthdate: new Date('1960-01-01'), residencyStatus: 'temporary', household: { occupation: 'nurse', isMarried: false, hasChildren: true }, permanentAddress: { purok: 'purok 1' }, specialCategory: 'senior_citizen' }, { isActive: false }],
    ['deleted', { name: { firstName: 'Archived', lastName: 'Resident', gender: 'man' }, household: { occupation: 'Excluded occupation' } }, { deletedAt: day }],
  ]
  const entries = []
  for (const [key, data, flags] of profiles) { const uid = `${tag}-${key}`; entries.push([`users/${uid}`, user(uid, 'resident', flags)], [`residents/${uid}`, residentProfile(uid, data)]) }
  for (const [id, data] of [[sid, { title: 'Health, "survey"', status: 'inactive', startDate: yesterday, endDate: yesterday }], [empty, { title: 'Empty survey', status: 'inactive' }], [open, { title: 'Open survey' }], [future, { title: 'Future survey', startDate: tomorrow, endDate: tomorrow }]]) entries.push([`surveys/${id}`, survey({ ...data, createdByUid: `${tag}-staff`, createdAt: new Date(Date.now() + 1000) })])
  for (const [i, type] of ['multiple_choice', 'yesno', 'rating', 'short_answer'].entries()) for (const id of [sid, empty]) entries.push([`surveys/${id}/questions/q${i}`, { text: `Question ${type}`, type, order: i + 1, legacyId: i + 1 }])
  for (const id of [sid, empty]) for (const [i, text] of ['A, choice', 'B'].entries()) entries.push([`surveys/${id}/questions/q0/choices/c${i}`, { text, order: i, legacyId: 10 + i }])
  for (let i = 0; i < 3; i++) {
    const rid = `${sid}_r${i}`, submittedAt = new Date(`2026-01-0${i + 1}T16:30:00Z`)
    entries.push([`responses/${rid}`, { surveyId: sid, residentUid: `${tag}-${['alpha', 'beta', 'deleted'][i]}`, submittedAt, legacyId: 700 + i }])
    for (const [n, value] of [{ choiceId: i === 2 ? 'deleted-choice' : 'c0' }, { text: i ? 'No' : 'Yes' }, { rating: [1, 5, 5][i] }, { text: ['line one\nline two', '"quote", comma', ''][i] }].entries()) entries.push([`responses/${rid}/answers/q${n}`, { questionId: `q${n}`, choiceId: null, rating: null, text: '', ...value, legacyId: 100 + i * 4 + n }])
  }
  // Login panel stored-role behavior differs deliberately from the historical drilldown.
  entries.push([`loginHistory/${tag}-login`, { actorUid: `${tag}-alpha`, accountType: 'resident', accountRole: 'Temporary Resident', event: 'login', at: new Date(Date.now() + 10000), legacyId: null }],
    [`loginHistory/${tag}-logout`, { actorUid: `${tag}-staff`, accountType: 'staff', accountRole: 'Admin', event: 'logout', at: new Date(Date.now() + 10000), legacyId: null }])
  await seed(entries)
  dev = startAuthDev(); await Promise.all([ready(app), ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')])
  console.log('Checking report API counts, demographics and source ordering')
  const all = await snapshot()
  const adminData = (await api('dashboard', {}, 'admin')).data
  check(Boolean(adminData), 'Admin dashboard available')
  const rows = collection => [...all.entries()].filter(([p]) => p.startsWith(collection + '/') && p.split('/').length === 2).map(([p, data]) => ({ id: p.split('/')[1], ...data }))
  const people = new Map(rows('users').map(u => [u.id, u])), live = rows('residents').filter(p => people.has(p.id) && people.get(p.id).role === 'resident' && !people.get(p.id).deletedAt)
  const surveys = rows('surveys'), responses = rows('responses'), today = new Date(Date.now() + 28800000).toISOString().slice(0, 10), midnight = Date.parse(today + 'T00:00:00+08:00')
  const eligible = live.filter(p => people.get(p.id).isActive).length, distinct = new Set(responses.map(r => r.residentUid)).size
  const instant = value => value.toDate().getTime(), calendar = value => value.toDate().toISOString().slice(0, 10)
  equal(adminData.active_surveys, surveys.filter(s => s.status === 'active' && calendar(s.startDate) <= today && calendar(s.endDate) >= today).length, 'Original dashboard inclusive open window')
  equal(adminData.inactive_surveys, surveys.filter(s => s.status === 'inactive').length, 'Inactive count')
  equal(adminData.closed_surveys, surveys.filter(s => calendar(s.endDate) < today).length, 'Original closed count includes all statuses')
  equal(adminData.avg_responses, surveys.length ? Math.round(responses.length / surveys.length * 10) / 10 : 0, 'One-decimal dashboard average')
  equal(adminData.responses_7, responses.filter(r => instant(r.submittedAt) >= midnight - 7 * 86400000).length, 'Seven-day boundary starts at Manila midnight')
  equal(adminData.responses_prev_7, responses.filter(r => instant(r.submittedAt) >= midnight - 14 * 86400000 && instant(r.submittedAt) < midnight - 7 * 86400000).length, 'Previous seven-day exclusive cutoff')
  equal(adminData.new_residents_30, live.filter(p => instant(p.createdAt) >= midnight - 30 * 86400000).length, 'Thirty-day resident cutoff and archived exclusion')
  equal(adminData.eligible_residents, eligible, 'Active nonarchived denominator')
  equal(adminData.responding_residents, distinct, 'Participation distinct responders includes historical residents')
  equal(adminData.participation, eligible ? Math.min(100, Math.round(distinct / eligible * 100)) : 0, 'Participation rounds and clamps to 100')
  equal(adminData.temporary_residents, live.filter(p => p.residencyStatus === 'temporary').length, 'Temporary residency count')
  equal(adminData.permanent_residents, live.filter(p => p.residencyStatus !== 'temporary').length, 'Permanent residency count')
  equal(adminData.admin.deactivated_residents, live.filter(p => !people.get(p.id).isActive).length, 'Deactivated residents exclude archived')
  equal(adminData.admin.total_staff, [...people.values()].filter(u => ['staff', 'admin'].includes(u.role) && !u.deletedAt).length, 'Admin worker count')
  equal(adminData.admin.deactivated_staff, [...people.values()].filter(u => ['staff', 'admin'].includes(u.role) && !u.deletedAt && !u.isActive).length, 'Admin deactivated worker count')
  equal(adminData.pending_address_requests, rows('nameAddressRequests').filter(r => r.status === 'pending').length, 'Pending name/address count')
  equal(adminData.admin.pending_deletion_requests, rows('deletionRequests').filter(r => r.status === 'pending').length, 'Pending deletion count')
  const married = live.filter(p => p.household.isMarried).length, children = live.filter(p => p.household.hasChildren).length
  equal(adminData.charts.household.map(r => r.value), [married, live.length - married, children, live.length - children], 'Household chart uses original live-resident denominators')
  const ageBands = [0, 0, 0, 0]
  for (const person of live) if (person.birthdate) { const born = calendar(person.birthdate); const age = Number(today.slice(0, 4)) - Number(born.slice(0, 4)) - (today.slice(5) < born.slice(5) ? 1 : 0); ageBands[age < 18 ? 0 : age < 35 ? 1 : age < 60 ? 2 : 3]++ }
  equal(adminData.charts.age_groups.map(r => r.value), ageBands, 'Age bands use date-only birthday and Manila today')
  equal(adminData.charts.residency_mix.map(r => r.value), [live.filter(p => p.residencyStatus !== 'temporary').length, live.filter(p => p.residencyStatus === 'temporary').length], 'Residency chart matches headline denominator')
  equal(adminData.total_surveys, [...all.keys()].filter(p => /^surveys\/[^/]+$/.test(p)).length, 'Dashboard counts every survey')
  equal(adminData.total_responses, [...all.keys()].filter(p => /^responses\/[^/]+$/.test(p)).length, 'Dashboard response count')
  equal(adminData.total_residents, [...all.entries()].filter(([p, d]) => /^users\/[^/]+$/.test(p) && d.role === 'resident' && !d.deletedAt).length, 'Live residents exclude archived')
  check(adminData.admin.recent_logins.some(r => r.person === 'Ava Álpha' && r.type_label.text === 'Temporary Resident'), 'Dashboard uses stored portal role')
  check(adminData.admin.recent_logouts.some(r => r.person === 'Fixture staff' && r.type_label.text === 'Admin'), 'Admin logout panel uses stored role')
  const staffData = (await api('dashboard')).data
  check(!Object.hasOwn(staffData, 'admin') && !staffData.is_admin_view, 'Staff never receives login/logout or administrator block')
  equal(staffData.charts, adminData.charts, 'Staff and admin share same survey/demographic figures')
  check(!JSON.stringify(staffData).includes('contact_number') && !JSON.stringify(staffData).includes('birthdate'), 'Dashboard projection excludes private profile fields')
  const residentRows = (await api('detail', { view: 'total_residents' })).data.rows
  check(residentRows.some(r => r.first_name === 'Ava') && !residentRows.some(r => r.first_name === 'Archived'), 'Resident drilldown omits archived residents')
  const activity = (await api('detail', { view: 'recent_logins' }, 'admin')).data.rows
  check(activity.some(r => r.person === 'Ava Álpha' && r.type_label.text === 'Permanent Resident'), 'Activity drilldown uses current role, matching original')
  check(activity.some(r => r.person === 'Fixture staff' && r.type_label.text === 'Staff'), 'Historical drilldown includes logout event and resolves current role')
  for (const view of ['staff_accounts', 'deactivated_staff', 'deactivated_residents', 'recent_logins']) equal((await api('detail', { view })).redirect, '/staff/dashboard', 'Staff admin-only drilldown redirects')
  for (const view of ['bad', 'recent_logouts']) equal((await api('detail', { view }, 'admin')).redirect, '/staff/dashboard', 'Original whitelist rejects unsupported drilldown')
  const active = (await api('detail', { view: 'active_surveys' })).data.rows
  check(active.some(r => r.survey_id === open && r.days_left === 0) && !active.some(r => [sid, empty, future].includes(r.survey_id)), 'Inclusive Manila active-period filter')
  const results = (await api('results', { survey_id: sid })).data
  equal(results.total_respondents, 3, 'Closed-survey respondents retained including archived resident')
  equal(results.questions.map(q => q.question_type), ['multiple_choice', 'yesno', 'rating', 'short_answer'], 'Question source order')
  equal(results.questions[0].breakdown.map(r => [r.votes, r.percent, r.winning]), [[2, 100, true], [0, 0, false]], 'Deleted choice excluded and percentages use question denominator')
  equal(results.questions[1].breakdown.map(r => r.votes), [1, 2], 'Yes then No ordering')
  equal(results.questions[2].avg_rating, 3.67, 'PHP-compatible rating average')
  equal(results.questions[2].breakdown.map(r => r.votes), [1, 0, 0, 0, 2], 'Unused stars retained')
  equal(results.questions[3].answers.map(r => r.answer_text), ['"quote", comma', 'line one\nline two'], 'Newest imported answer first and blanks excluded')
  equal(results.questions[3].answers[1].submitted_at_label, 'Jan 2, 2026', 'Manila midnight answer date')
  const printData = (await api('report', { survey_id: sid })).data
  equal(printData.survey.created_by_name, 'Fixture staff', 'Print creator resolves through Firebase')
  equal(printData.questions[3].rows.map(r => r.answer_text), ['line one\nline two', '"quote", comma'], 'Original CSV/print text ordering')
  equal((await api('results', { survey_id: empty })).data.questions[1].breakdown.map(r => r.votes), [0, 0], 'Empty yes/no keeps both options')
  equal((await api('report', { survey_id: empty })).data.questions[2].rows.map(r => r.votes), [0, 0, 0, 0, 0], 'Empty print keeps five ratings')
  equal((await api('results', { survey_id: `${tag}-missing` })).data.survey, null, 'Deleted survey has missing state')
  equal((await api('csv', { survey_id: `${tag}-missing` })).redirect, '/staff/reports', 'Missing CSV preserves redirect')
  equal((await api('trend', { from: '2026-01-03', to: '2026-01-01' })).data.response_trend.map(r => r.value).slice(0, 2), [0, 1], 'Trend dates swap and group by Manila date')
  console.log('Checking report authorization and lifecycle refusals')
  for (const role of ['resident', 'inactive', 'archived', 'first', 'onboarding', 'unprovisioned', 'anonymous']) for (const action of ['dashboard', 'trend', 'detail', 'results', 'report', 'csv']) check([401, 403].includes((await api(action, { survey_id: sid, view: 'recent_logins', uid: `${tag}-admin`, role: 'admin' }, role)).status), `${role} refused ${action}`)
  for (const survey_id of ['../users', 'bad/id', { bad: true }]) equal((await api('results', { survey_id })).status, 400, 'Survey path injection refused')
  console.log('Checking report browser charts, drilldowns, search, print and CSV')
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await signedPage('staff')
  await page.goto(app + 'staff/dashboard'); await page.getByRole('heading', { name: 'Staff Dashboard', exact: true }).waitFor()
  check(await page.locator('#chart-trend').isVisible(), 'Dashboard trend canvas renders')
  check(await page.getByRole('heading', { name: 'Resident Demographics', exact: true }).isVisible(), 'Demographic panels render')
  for (const view of ['total_surveys', 'active_surveys', 'total_residents', 'total_responses']) {
    await page.goto(app + `staff/stat-detail?view=${view}`); await page.locator('.detail-count').waitFor(); check(await page.locator('table tbody tr').count() > 0, `Browser ${view} drilldown`)
  }
  await page.goto(app + 'staff/dashboard'); await page.locator('#trend-from').fill('2026-01-01'); await page.locator('#trend-to').fill('2026-01-04')
  let request = page.waitForResponse(r => r.url().endsWith('/staff-reports.php') && r.request().postDataJSON().action === 'trend')
  await page.locator('#trend-apply').click(); check((await (await request).json()).ok, 'Nested trend Apply uses Firebase service')
  request = page.waitForResponse(r => r.url().endsWith('/staff-reports.php') && r.request().postDataJSON().action === 'trend')
  await page.locator('#trend-reset').click(); check((await (await request).json()).ok, 'Nested trend reset uses Firebase service')
  await page.goto(app + 'staff/results-dashboard'); await page.locator('#survey_id').selectOption(sid); await page.locator('[data-answer-search]').waitFor()
  check(await page.getByText('3.67', { exact: true }).isVisible(), 'Rating displayed in browser')
  await page.locator('[data-answer-search]').fill('quote'); equal(await page.locator('[data-answer-text]:visible').count(), 1, 'Answer search filters locally')
  await page.locator('[data-answer-search]').fill('no matching phrase'); await page.getByText('No answers match your search.', { exact: true }).waitFor(); checks++
  await page.getByRole('link', { name: 'Printable Report', exact: true }).click(); await page.getByRole('button', { name: 'Print Report', exact: true }).waitFor()
  await page.evaluate(() => { window.print = () => { window.reportPrinted = true } })
  await page.getByRole('button', { name: 'Print Report', exact: true }).click(); check(await page.evaluate(() => window.reportPrinted), 'Print invokes browser print')
  await page.emulateMedia({ media: 'print' }); equal(await page.locator('.no-print:visible').count(), 0, 'Print CSS hides report controls'); await page.emulateMedia({ media: 'screen' })
  const download = page.waitForEvent('download'); await page.getByRole('link', { name: 'Export to CSV (Excel)', exact: true }).click(); const file = await download
  const csv = (await api('csv', { survey_id: sid })).data
  equal(file.suggestedFilename(), csv.filename, 'Nested CSV filename'); equal(await readFile(await file.path(), 'utf8'), csv.csv, 'Browser download equals Firebase CSV bytes')
  check(csv.csv.includes('"line one\nline two"') && csv.csv.includes('"""quote"", comma"'), 'CSV quoting/newline preserved')
  await page.goto(app + `staff/results-dashboard?survey_id=${empty}`); await page.getByText('No text responses have been submitted yet.', { exact: true }).waitFor(); checks++
  await page.goto(app + 'staff/reports'); await page.locator('#survey_id').waitFor(); equal(await page.getByRole('button', { name: 'Print Report' }).count(), 0, 'No survey hides print/export controls')
  await page.goto(app + `staff/results-dashboard?survey_id=${tag}-missing`); await page.getByText('Survey not found.', { exact: true }).waitFor(); checks++
  await page.goto(app + 'staff/stat-detail?view=staff_accounts'); await page.waitForURL(app + 'staff/dashboard'); checks++
  const adminPage = await signedPage('admin')
  await adminPage.goto(app + 'staff/dashboard'); await adminPage.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor(); check(await adminPage.getByRole('heading', { name: 'Accounts & Access', exact: true }).isVisible(), 'Admin access panels render')
  for (const view of ['staff_accounts', 'deactivated_staff', 'deactivated_residents', 'recent_logins']) { await adminPage.goto(app + `staff/stat-detail?view=${view}`); await adminPage.locator('.detail-count').waitFor(); checks++ }
  const residentPage = await signedPage('resident'); await residentPage.goto(app + 'staff/dashboard'); await residentPage.waitForURL(app + 'resident/dashboard'); checks++
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(app + `staff/results-dashboard?survey_id=${sid}`); await page.locator('[data-answer-search]').waitFor(); check(await page.locator('#survey_id').isVisible(), 'Existing result layout renders on phone')
  check(diagnostics.length === 0, `No legacy requests, production requests or browser exceptions: ${diagnostics.join('; ')}`)
} finally {
  console.log('Restoring synthetic report fixtures and verifying original state')
  await browser?.close(); dev?.stop()
  const current = await snapshot(), cleanup = [...current.entries()].filter(([path, data]) => owned.has(path) || path.includes(tag) || data.actorUid?.startsWith(tag)).map(([path]) => path)
  for (let i = 0; i < cleanup.length; i += 400) { const batch = db.batch(); cleanup.slice(i, i + 400).forEach(path => batch.delete(db.doc(path))); await batch.commit() }
  // Restore exact before-images if an unrelated shared helper ever changes a document, including counters.
  const after = await snapshot(), unchanged = isDeepStrictEqual(after, original)
  for (const [path, data] of original) if (!isDeepStrictEqual(after.get(path), data)) await db.doc(path).set(data)
  for (const uid of identities) await auth.deleteUser(uid)
  equal(await snapshot(), original, 'All original emulator documents preserved exactly')
  equal((await auth.listUsers(1000)).users.map(u => u.uid).sort(), originalAuth, 'All original Auth accounts preserved')
  await db.terminate(); await deleteApp(admin)
  check(unchanged, 'Reports flow did not change pre-existing documents/counters')
}
console.log(`PASS: ${checks} reports emulator/browser checks; preserved ${original.size} original documents and ${originalAuth.length} Auth accounts.`)
