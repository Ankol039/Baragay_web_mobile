import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'
import { validateResponse, responseMessages } from '../src/shared/validateResponse.js'
Object.assign(process.env, emulatorEnv)
const { base, call, commit, write, remove, user, residentProfile, survey, day } = await import('./firestore-fixtures.mjs')
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const app = 'http://127.0.0.1:5173/barangay_survey_system/app/'
const tag = `submit-${randomUUID().slice(0, 8)}`, uid = `${tag}-resident`, docs = new Set(), diagnostics = []
const email = `${tag}@example.invalid`, password = 'FixturePass8', identifier = 'R-2026-8999'
let browser, dev, checks = 0, token
const check = (condition, label) => { assert(condition, label); checks++ }
const questions = [
  { id: 'mc', type: 'multiple_choice', text: 'Choose one', order: 1, choices: [{ id: 'a', text: 'A, "quoted"' }] },
  { id: 'yn', type: 'yesno', text: 'Yes or No', order: 2, choices: [] },
  { id: 'rating', type: 'rating', text: 'Rate your visit', order: 3, choices: [] },
  { id: 'text', type: 'short_answer', text: 'Your comments', order: 4, choices: [] },
]
const input = { qmc: 'choice_a', qyn: 'No', qrating: '5', qtext: '  Hello, "CSV"\nSecond line  ' }
async function rest(url, auth, body, method) {
  const result = await call(url, auth, body, method)
  check(result.ok, `Local fixture operation failed (${result.status})`)
  return result.body
}
async function seed(path, data) {
  await rest(`${base}:commit`, 'owner', { writes: [{ ...write(path, data), currentDocument: { exists: false } }] })
  docs.add(path)
}
async function fixture(suffix, extra = {}, qs = questions) {
  const sid = `${tag}-${suffix}`
  await seed(`surveys/${sid}`, survey({ createdByUid: 'staff-fixture', ...extra }))
  for (const { id, choices, ...q } of qs) {
    await seed(`surveys/${sid}/questions/${id}`, { ...q, legacyId: null })
    for (const [i, c] of choices.entries()) await seed(`surveys/${sid}/questions/${id}/choices/${c.id}`, { text: c.text, order: i, legacyId: null })
  }
  docs.add(`surveys/${sid}/validation/response`)
  docs.add(`responses/${sid}_${uid}`)
  for (const q of qs) docs.add(`responses/${sid}_${uid}/answers/${q.id}`)
  return sid
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
    const service = await import('/barangay_survey_system/app/src/services/surveyService.js')
    try { return await service[name](...args) }
    catch (error) { return { error: error.message, status: error.status } }
  }, { name, args })
}
async function prepare(sid) {
  const r = await fetch('http://127.0.0.1:8787/api/firebase/survey-schema.php', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token, surveyId: sid, required: 'forged-empty' }) })
  const payload = await r.json()
  if (!r.ok || !payload.data?.ready) console.log('Schema outcome:', r.status, payload)
  check(r.ok && payload.data?.ready, 'Bridge derives required metadata without trusting client fields')
}
async function absent(sid) {
  check((await call(`${base}/responses/${sid}_${uid}`, 'owner')).status === 404, 'Refused submission stores no parent')
  const answers = await rest(`${base}/responses/${sid}_${uid}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: 'answers' }] } })
  check(!answers.some(row => row.document), 'Refused atomic submission stores no answers')
}
function writes(sid, answers, overrides = {}) {
  const rid = `${sid}_${uid}`
  const result = [write(`responses/${rid}`, { surveyId: sid, residentUid: uid, surveyTitle: 'Fixture survey',
    firstAnswerId: answers[0]?.questionId || 'mc', submittedAt: day, legacyId: null, ...overrides }, ['submittedAt']),
    ...answers.map(answer => write(`responses/${rid}/answers/${answer.questionId}`, { ...answer, submittedAt: day }, ['submittedAt']))]
  for (const entry of result) if (entry.update?.fields.rating?.integerValue?.includes('.')) entry.update.fields.rating = { doubleValue: Number(entry.update.fields.rating.integerValue) }
  return result
}
async function denied(sid, answers, overrides) {
  const result = await commit(token, writes(sid, answers, overrides))
  check(result.status === 403, 'Direct rules bypass refused')
  await absent(sid)
}
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Local emulators running')
  // Explicitly compile/load local rules, never deploy them to Firebase.
  await rest(`http://127.0.0.1:8080/emulator/v1/projects/${project}:securityRules`, 'owner',
    { rules: { files: [{ name: 'firestore.rules', content: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') }] } }, 'PUT')
  await rest(`${authBase}/projects/${project}/accounts`, 'owner', { localId: uid, email, password })
  await seed(`users/${uid}`, user(uid, 'resident', { identifier }))
  await seed(`residents/${uid}`, residentProfile(uid))
  const normalizedIdentifier = identifier.toLowerCase()
  await seed(`identifierAliases/residentNumber_${createHash('sha256').update(normalizedIdentifier).digest('hex')}`,
    { kind: 'residentNumber', normalizedIdentifier, uid, authEmail: email, createdAt: day })
  const signed = await rest(`${authBase}/accounts:signInWithPassword?key=emulator-only`, null, { email, password, returnSecureToken: true })
  token = signed.idToken
  const sid = await fixture('valid'), empty = await fixture('empty'), invalid = await fixture('invalid')
  const rules = await fixture('rules'), race = await fixture('race'), closing = await fixture('closing'), failed = await fixture('failed')
  await seed(`surveys/${rules}/questions/other`, { text: 'Other choice question', type: 'multiple_choice', order: 5, required: false, legacyId: null })
  await seed(`surveys/${rules}/questions/other/choices/foreign`, { text: 'Foreign choice', order: 1, legacyId: null })
  const textOnly = await fixture('text-only', {}, [questions[3]])
  const requiredText = await fixture('required-text', {}, [questions[3], { ...questions[2], required: false }].map(q => ({ ...q, required: q.id === 'text' })))
  const closed = await fixture('closed', { status: 'inactive' }), past = await fixture('past', { startDate: new Date(day - 86400000), endDate: new Date(day - 86400000) })
  const future = await fixture('future', { startDate: new Date(+day + 86400000), endDate: new Date(+day + 86400000) })
  dev = startAuthDev()
  await Promise.all([ready(app), ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')])
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Production request'); return route.abort() })
  await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/firebase/'), route => { diagnostics.push('Legacy request'); return route.abort() })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.push(error.message))
  await page.goto(app + 'login')
  await page.locator('#identifier').fill(identifier); await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await page.waitForURL(app + 'resident/dashboard')
  console.log('Checking original form and service refusals')
  const data = await service(page, 'getSurvey', sid)
  check(data.data.questions.map(q => q.question_id).join() === 'mc,yn,rating,text', 'Loads all ordered questions and owned choices')
  check(data.data.questions[0].choices[0].choice_text === questions[0].choices[0].text, 'Choice labels unchanged')
  await page.goto(app + `resident/survey-form?id=${sid}`)
  await page.locator('#survey-answer-form').waitFor()
  page.once('dialog', async alert => { check(alert.message() === responseMessages.required, 'Original required-question alert'); await alert.accept() })
  await page.getByRole('button', { name: 'Submit Survey' }).click()
  check(await page.locator('.missing').count() === 3, 'Original required-group highlights')
  await absent(sid)
  await prepare(empty)
  const emptyResult = await service(page, 'submitResponse', empty, {})
  check(emptyResult.redirect.endsWith('&error=empty'), 'Empty service submission preserves original redirect')
  await page.goto(app + `resident/survey-form?id=${empty}&error=empty`)
  await page.getByText(responseMessages.empty, { exact: true }).waitFor()
  check(true, 'Exact original empty message rendered')
  await absent(empty)
  for (const bad of [{ ...input, qmc: 'choice_foreign' }, { ...input, qrating: '6' }, { ...input, qyn: 'yes' }, { qtext: 'Partial' }]) {
    const result = await service(page, 'submitResponse', invalid, bad)
    check(result.error === responseMessages.required && result.status === 422, 'Invalid/partial submission refused with original required message')
    await absent(invalid)
  }
  check((await service(page, 'submitResponse', invalid, { ...input, qtext: 'a'.repeat(20001) })).error === responseMessages.length, 'Text-length client refusal')
  await absent(invalid)
  for (const id of [closed, past, future, `${tag}-missing`]) {
    check((await service(page, 'getSurvey', id)).redirect === '/resident/surveys', 'Closed/missing form preserves quiet list redirect')
    check((await service(page, 'submitResponse', id, input)).redirect === '/resident/surveys', 'Closed/missing submit preserves quiet list redirect')
    await absent(id)
  }
  console.log('Checking direct rules bypasses')
  const correct = validateResponse(questions, input).answers
  await denied(rules, correct) // A missing trusted schema is never a bypass.
  await prepare(rules)
  await denied(rules, [])
  await denied(rules, [correct[0]]) // First required present, later required omitted.
  await denied(rules, [correct[0], correct[2]]) // Skip a middle link.
  await denied(rules, correct.map(a => a.type === 'multiple_choice' ? { ...a, choiceId: 'foreign' } : a))
  await denied(rules, correct.map(a => a.type === 'rating' ? { ...a, rating: 6 } : a))
  await denied(rules, correct.map(a => a.type === 'rating' ? { ...a, rating: 1.5 } : a))
  await denied(rules, correct.map(a => a.type === 'yesno' ? { ...a, text: 'Maybe' } : a))
  await denied(rules, correct.map(a => a.type === 'short_answer' ? { ...a, text: 'x'.repeat(20001) } : a))
  await denied(rules, correct.map(a => a.type === 'short_answer' ? { ...a, text: ' \n\t\r\0\v' } : a))
  await denied(rules, correct, { residentUid: 'someone-else' })
  check((await commit(token, [write(`surveys/${rules}/validation/response`, { firstRequiredId: '', requiredNext: {}, surveyVersion: day })])).status === 403, 'Client cannot forge required-question metadata')
  await prepare(requiredText)
  await denied(requiredText, [correct[2]])
  check((await service(page, 'submitResponse', requiredText, { qtext: 'Required comment' })).redirect.includes('?submitted='), 'Explicit required text and optional rating work')
  const schema = await rest(`${base}/surveys/${rules}/validation/response`, 'owner')
  await rest(`${base}:commit`, 'owner', { writes: [{ update: { name: schema.name, fields: { surveyVersion: { timestampValue: '2001-01-01T00:00:00Z' } } }, updateMask: { fieldPaths: ['surveyVersion'] } }] })
  await denied(rules, correct) // Stale metadata must fail closed.
  await prepare(rules)
  for (const id of [closed, past, future]) {
    await seed(`surveys/${id}/validation/response`, { surveyVersion: new Date('2020-01-01T00:00:00Z'), firstRequiredId: 'mc', requiredNext: { mc: 'rating', rating: 'yn', yn: '' } })
    await denied(id, correct)
  }
  const failRoute = '**/api/firebase/survey-schema.php'
  await context.route(failRoute, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Local test failure' }) }))
  check((await service(page, 'submitResponse', failed, input)).redirect.endsWith('&error=failed'), 'Preparation failure preserves original retry flow')
  await context.unroute(failRoute)
  await absent(failed)
  await page.goto(app + `resident/survey-form?id=${failed}&error=failed`)
  await page.getByText(responseMessages.failed, { exact: true }).waitFor()
  check(true, 'Exact original failure message rendered')
  await context.route(failRoute, async route => {
    const response = await route.fetch()
    await rest(`${base}:commit`, 'owner', { writes: [{ update: { name: write(`surveys/${closing}`, {}).update.name, fields: { status: { stringValue: 'inactive' } } }, updateMask: { fieldPaths: ['status'] }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }] })
    await route.fulfill({ response })
  })
  check((await service(page, 'submitResponse', closing, input)).redirect === '/resident/surveys', 'Closure after form load is rechecked at commit')
  await context.unroute(failRoute)
  await absent(closing)
  check((await service(page, 'submitResponse', textOnly, { qtext: ' \n\t ' })).redirect.endsWith('&error=empty'), 'Whitespace-only optional form refused')
  await absent(textOnly)
  await prepare(textOnly)
  await denied(textOnly, [{ ...correct[3], text: ' \n\t\r\0\v' }])
  check((await service(page, 'submitResponse', textOnly, { qtext: '😀'.repeat(10000) })).redirect.includes('?submitted='), 'Maximum UTF-16 text length accepted by shared validator and rules')
  const oversized = await fixture('oversized', {}, [questions[3]])
  check((await service(page, 'submitResponse', oversized, { qtext: '😀'.repeat(10001) })).error === responseMessages.length, 'Oversized Unicode refused on client')
  await prepare(oversized)
  await denied(oversized, [{ ...correct[3], text: '😀'.repeat(10001) }])
  const sixQuestions = Array.from({ length: 6 }, (_, i) => ({ id: `rating${i}`, type: 'rating', text: `Rating ${i}`, order: i, choices: [] }))
  const six = await fixture('six-required', {}, sixQuestions)
  check((await service(page, 'submitResponse', six, Object.fromEntries(sixQuestions.map(q => [`q${q.id}`, '4'])))).redirect.includes('?submitted='), 'Six required answers fit the atomic rules budget')
  console.log('Checking concurrent transactions and browser save')
  const simultaneous = await page.evaluate(async ({ race, input }) => {
    const service = await import('/barangay_survey_system/app/src/services/surveyService.js')
    return Promise.all([service.submitResponse(race, input), service.submitResponse(race, input)])
  }, { race, input })
  check(simultaneous.filter(r => r.redirect.includes('?submitted=')).length === 1 && simultaneous.filter(r => r.redirect === '/resident/surveys').length === 1, 'Two concurrent SDK transactions store one response')
  await page.goto(app + `resident/survey-form?id=${sid}`)
  await page.locator('#survey-answer-form').waitFor()
  await page.locator('label[for="qmc_ca"]').click(); await page.locator('label[for="qyn_no"]').click(); await page.locator('label[for="qrating_r5"]').click()
  await page.locator('textarea').fill(input.qtext)
  await page.getByRole('button', { name: 'Submit Survey' }).click()
  await page.locator('#submitted-modal').waitFor({ state: 'visible' })
  check(await page.getByRole('heading', { name: 'Submission confirmed' }).isVisible(), 'Original success modal after actual browser submission')
  const stored = await rest(`${base}/responses/${sid}_${uid}`, 'owner')
  check(stored.fields.residentUid.stringValue === uid && stored.fields.surveyId.stringValue === sid && !!stored.fields.submittedAt.timestampValue, 'Deterministic response document stored with server time')
  const saved = await rest(`${base}/responses/${sid}_${uid}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: 'answers' }] } })
  check(saved.filter(row => row.document).length === 4, 'All four answers stored atomically')
  check((await service(page, 'submitResponse', sid, input)).redirect === '/resident/surveys', 'Second submission preserves original quiet redirect')
  check((await rest(`${base}/responses/${sid}_${uid}`, 'owner')).fields.submittedAt.timestampValue === stored.fields.submittedAt.timestampValue, 'Second submission does not change saved response')
  check((await commit(token, writes(sid, correct))).status === 403, 'Direct duplicate writes refused')
  check((await commit(token, [write(`responses/${sid}_${uid}/answers/late`, { ...correct[0], questionId: 'late' })])).status === 403, 'Late answer refused')
  docs.add(`responses/${sid}_${uid}/answers/late`)
  await page.goto(app + `resident/view-response?id=${sid}_${uid}`)
  await page.locator('.response-print-card').waitFor()
  check(await page.locator('.submitted-answer').count() === 4, 'New response opens in existing history view')
  const direct = await service(page, 'getResponseCsv', `${sid}_${uid}`)
  check(direct.csv.includes('5 / 5') && direct.csv.includes('"A, ""quoted"""') && direct.csv.includes('Second line'), 'Client CSV contains exact rating, quote and multiline encoding')
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('link', { name: 'Download CSV' }).click()
  const download = await downloadEvent
  check(download.suggestedFilename() === `survey-response-${sid}_${uid}.csv` && await readFile(await download.path(), 'utf8') === direct.csv, 'Browser CSV bytes and filename match service')
  await page.goto(app + `resident/confirmation?survey_id=${sid}`)
  await page.getByText('Your response to "Fixture survey" has been submitted successfully.', { exact: true }).waitFor()
  check(true, 'Standalone Confirmation uses Firestore and original message')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(app + `resident/survey-form?id=${empty}`); await page.locator('#survey-answer-form').waitFor()
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Survey form retains phone layout')
  assert.deepEqual(diagnostics, [], 'No legacy requests, production requests or browser exceptions')
  console.log(`PASS: ${checks} survey emulator/browser checks; atomic storage, replay/race, required answers, invalid choices/ratings/text, closed surveys, original messages and client CSV.`)
} finally {
  await browser?.close(); dev?.stop()
  const audit = await call(`${base}:runQuery`, 'owner', { structuredQuery: { from: [{ collectionId: 'loginHistory' }], where: { fieldFilter: { field: { fieldPath: 'actorUid' }, op: 'EQUAL', value: { stringValue: uid } } } } })
  for (const row of audit.body || []) if (row.document) docs.add(`loginHistory/${row.document.name.split('/').at(-1)}`)
  if (docs.size) check((await commit('owner', [...docs].map(remove))).ok, 'Only synthetic fixtures cleaned')
  await call(`${authBase}/projects/${project}/accounts:delete`, 'owner', { localId: uid })
}
