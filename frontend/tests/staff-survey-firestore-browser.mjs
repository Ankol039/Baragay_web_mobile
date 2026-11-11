import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { chromium } from 'playwright'
import { emulatorEnv, project, startAuthDev } from '../scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
const { call, commit, write, user, residentProfile, staffProfile, day, survey } = await import('./firestore-fixtures.mjs')
const require = createRequire(new URL('../../migration/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const admin = initializeApp({ projectId: project }, 'staff-survey-local-test'), db = getFirestore(admin), auth = getAuth(admin)
const app = 'http://127.0.0.1:5173/barangay_survey_system/app/'
const endpoint = 'http://127.0.0.1:8787/api/firebase/staff-surveys.php'
const tag = `staff-survey-${randomUUID().slice(0, 8)}`, password = 'FixturePass8', tokens = {}, identities = [], created = new Set(), diagnostics = []
let browser, dev, checks = 0
const check = (condition, label) => { assert(condition, label); checks++ }
async function snapshot() {
  const result = new Map()
  async function walk(parent) {
    for (const collection of await parent.listCollections()) for (const ref of await collection.listDocuments()) {
      const document = await ref.get()
      if (document.exists) result.set(ref.path, document.data())
      await walk(ref)
    }
  }
  await walk(db)
  return result
}
async function seed(entries) {
  for (let i = 0; i < entries.length; i += 400) {
    const result = await commit('owner', entries.slice(i, i + 400).map(([path, data]) => ({ ...write(path, data), currentDocument: { exists: false } })))
    check(result.ok, 'Synthetic fixtures created without overwriting data')
  }
}
async function api(action, values = {}, role = 'staff') {
  const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...values, action, idToken: tokens[role] || '' }) })
  return { status: result.status, ...await result.json() }
}
async function service(page, method, args = [], module = 'staffSurveyService') {
  return page.evaluate(async ({ method, args, module }) => {
    try { return await (await import(`/barangay_survey_system/app/src/services/${module}.js`))[method](...args) }
    catch (error) { return { error: error.message, status: error.status } }
  }, { method, args, module })
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Local dev server did not start')
}
async function signedPage(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route(url => url.hostname.endsWith('googleapis.com'), route => { diagnostics.push('Production request'); return route.abort() })
  await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/firebase/'), route => { diagnostics.push('Legacy data request'); return route.abort() })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.push(error.message))
  await page.goto(app + 'login')
  await page.evaluate(async ({ email, password }) => {
    const { getFirebase } = await import('/barangay_survey_system/app/src/services/firebase.js')
    const { signInWithEmailAndPassword } = await import('/barangay_survey_system/app/node_modules/.vite/deps/firebase_auth.js')
    await signInWithEmailAndPassword(getFirebase().auth, email, password)
  }, { email: `${tag}-${role}@example.invalid`, password })
  return page
}
async function questions(sid) {
  const result = await api('questions', { survey_id: sid })
  check(result.ok, 'Staff loads survey questions')
  return result.data.questions
}
const defaults = { title: 'Community health survey', description: 'Please describe your visit.', start_date: day.toISOString().slice(0, 10), end_date: day.toISOString().slice(0, 10) }
const types = ['multiple_choice', 'yesno', 'rating', 'short_answer']
const original = await snapshot()
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Existing local emulators running')
  for (const role of ['staff', 'admin', 'resident', 'first', 'onboarding', 'inactive', 'archived', 'unprovisioned']) {
    const uid = `${tag}-${role}`, email = `${uid}@example.invalid`
    await auth.createUser({ uid, email, password }); identities.push(uid)
    const kind = role === 'resident' ? 'resident' : role === 'admin' ? 'admin' : 'staff'
    const extra = role === 'first' ? { isFirstLogin: true } : role === 'onboarding' ? { profileCompleted: false }
      : role === 'inactive' ? { isActive: false } : role === 'archived' ? { deletedAt: day } : {}
    if (role !== 'unprovisioned') await seed([[`users/${uid}`, user(uid, kind, extra)],
      [`${kind === 'resident' ? 'residents' : 'staff'}/${uid}`, kind === 'resident' ? residentProfile(uid) : { ...staffProfile(uid), createdByUid: null }]])
    const signed = await call('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', null, { email, password, returnSecureToken: true })
    check(signed.ok, 'Synthetic emulator identity signs in'); tokens[role] = signed.body.idToken
  }
  dev = startAuthDev(); await Promise.all([ready(app), ready('http://127.0.0.1:8787/api/firebase/index.php?action=rules')])
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await signedPage('staff')
  await page.goto(app + 'staff/add-survey'); await page.locator('#survey-builder-form').waitFor()
  await page.locator('#title').fill(defaults.title); await page.locator('#description').fill(defaults.description)
  await page.locator('#start_date').fill(defaults.start_date); await page.locator('#end_date').fill(defaults.end_date)
  for (const [i, type] of types.entries()) {
    if (i) await page.locator('#add-question-btn').click()
    const row = page.locator('#questions-container > .question-row').nth(i)
    await row.locator('input[name$="[text]"]').fill(`Question number ${i + 1}`)
    await row.locator('select').selectOption(type)
    if (!i) { await row.locator('.choice-row input').nth(0).fill('First choice'); await row.locator('.choice-row input').nth(1).fill('Second choice') }
  }
  const saved = page.waitForResponse(r => r.url().endsWith('/staff-surveys.php') && r.request().postDataJSON().action === 'create')
  await page.getByRole('button', { name: 'Save Survey', exact: true }).click()
  const creation = await (await saved).json(); check(creation.ok, 'Browser creates all four question types'); const sid = creation.data.survey_id; created.add(sid)
  await page.waitForURL(app + 'staff/survey-management')
  await page.getByRole('cell', { name: defaults.title, exact: true }).waitFor()
  let qs = await questions(sid)
  check(qs.map(q => q.question_type).join() === types.join(), 'All four types persisted in creation order')
  check(qs[0].choices.length === 2 && new Set(qs[0].choices.map(c => c.choice_id)).size === 2, 'Unique stable choice IDs')
  const mc = qs[0], originalIds = mc.choices.map(c => c.choice_id)
  check((await db.doc(`surveys/${sid}`).get()).data().createdByUid === `${tag}-staff`, 'Creator comes from verified Firebase identity')
  await page.goto(app + `staff/question-management?survey_id=${sid}`)
  await page.getByRole('button', { name: 'Move up', exact: true }).first().click()
  await page.locator('#question-success-modal.active').getByRole('button', { name: 'Done' }).click()
  qs = await questions(sid); check(qs[0].question_type === 'yesno' && qs[1].question_id === mc.question_id, 'Browser reorders existing question IDs')
  const mcRow = page.locator('tr').filter({ hasText: 'Question number 1' })
  await mcRow.getByRole('button', { name: 'Edit question' }).click()
  await page.locator('#edit_question_text').fill('Choose your preferred service')
  await page.locator('#edit-choices-inputs input').nth(0).fill('Corrected first choice')
  await page.locator('#edit-question-form').getByRole('button', { name: 'Save Changes' }).click()
  await page.locator('#question-success-modal.active').getByRole('button', { name: 'Done' }).click()
  qs = await questions(sid)
  check(qs[1].choices.map(c => c.choice_id).join() === originalIds.join(), 'Browser choice text edit retains IDs and ordering')
  check(qs[1].choices[0].choice_text === 'Corrected first choice', 'Edited choice text persisted')
  await page.goto(app + `staff/edit-survey?id=${sid}`); await page.locator('#title').fill('Updated community health survey')
  await page.getByRole('button', { name: 'Save Changes' }).click(); await page.getByText('Survey updated successfully.', { exact: true }).waitFor()
  check((await service(page, 'getSurvey', [sid])).data.survey.title === 'Updated community health survey', 'Browser metadata edit persists')
  await page.goto(app + 'staff/survey-management')
  const tableRow = page.locator('tr').filter({ hasText: 'Updated community health survey' })
  await tableRow.getByRole('button', { name: 'Deactivate survey' }).click(); await page.locator('#survey-confirm-modal-proceed').click()
  await tableRow.getByRole('button', { name: 'Activate survey' }).waitFor()
  check((await api('get', { id: sid })).data.survey.status === 'inactive', 'Browser deactivation persists')
  await tableRow.getByRole('button', { name: 'Activate survey' }).click(); await page.locator('#survey-confirm-modal-proceed').click()
  await tableRow.getByRole('button', { name: 'Deactivate survey' }).waitFor()
  check((await api('get', { id: sid })).data.survey.status === 'active', 'Browser activation persists')

  console.log('Checking PHP validation, choice ownership and question CRUD')
  const invalid = [
    [{ ...defaults, title: '' }, 'Title, start date, and end date are required.'],
    [{ ...defaults, title: 'aaaaaaaa' }, 'Give the survey a real title - at least eight characters that describe what it is about.'],
    [{ ...defaults, description: 'qwerty' }, 'Either write a proper description of at least ten characters, or leave it blank.'],
    [{ ...defaults, start_date: '2030-01-02', end_date: '2030-01-01' }, 'Start date cannot be after end date.'],
  ]
  for (const [data, message] of invalid) for (const action of ['create', 'update']) {
    const result = await api(action, { ...data, id: sid }); check(!result.ok && result.message === message, `Original ${action} metadata validation`)
  }
  check((await api('create', { ...defaults, questions: [{ text: '  ' }] })).message === 'Please add at least one question, and give it a question to ask.', 'Blank survey questions rejected')
  const beforeLimit = (await api('list')).data.surveys.length
  const oversized = await api('create', { ...defaults, questions: Array.from({ length: 500 }, () => ({ text: 'A real question', type: 'rating', choices: [] })) })
  check(oversized.status === 422 && !oversized.ok, 'Creation exceeding 500 writes fails safely')
  check((await api('list')).data.surveys.length === beforeLimit, 'Oversized creation stores no partial survey or questions')
  const loose = await api('create', { ...defaults, questions: [{ text: ' ', type: 'invalid' }, { text: 'x', type: 'multiple_choice', choices: ['Single choice', ' '] }] })
  check(loose.ok, 'Initial builder retains PHP’s looser question validation and skips blank rows')
  created.add(loose.data.survey_id)
  check((await questions(loose.data.survey_id))[0].choices.length === 1, 'Builder continues to ignore blank choices')
  check((await api('delete', { id: loose.data.survey_id })).ok, 'Disposable builder parity fixture deleted')
  for (const [fields, message] of [
    [{ question_text: '' }, 'Question text is required.'],
    [{ question_text: 'qwerty' }, 'Write the question out in words: at least five characters, and not one repeated character.'],
    [{ question_text: 'Choose a service', question_type: 'multiple_choice', choices: ['Only one', ' '] }, 'A multiple-choice question needs at least two choices. Blank boxes are ignored.'],
  ]) for (const action of ['questionCreate', 'questionUpdate']) check((await api(action, { survey_id: sid, question_id: mc.question_id, ...fields,
    ...(action === 'questionUpdate' && fields.choices ? { existing_choices: {}, new_choices: fields.choices } : {}) })).message === message, 'Original create/edit question validation message')
  check((await api('questionUpdate', { survey_id: sid, question_id: 'foreign' })).message === 'That question does not belong to this survey.', 'Cross-survey question update denied')
  check((await api('questionUpdate', { survey_id: sid, question_id: mc.question_id, question_text: 'Choose a service', question_type: 'multiple_choice', existing_choices: { foreign: 'Bad' }, new_choices: ['One', 'Two'] })).message === 'Invalid request field: existing_choices.', 'Foreign choice IDs rejected')
  const beforeQuestionLimit = (await db.doc(`surveys/${sid}/questions/${mc.question_id}`).get()).data()
  check((await api('questionUpdate', { survey_id: sid, question_id: mc.question_id, question_text: 'An oversized question edit', question_type: 'multiple_choice', existing_choices: {}, new_choices: Array(500).fill('New choice') })).status === 422, 'Oversized question update rejected atomically')
  check(isDeepStrictEqual((await db.doc(`surveys/${sid}/questions/${mc.question_id}`).get()).data(), beforeQuestionLimit), 'Oversized question edit leaves original question unchanged')
  check((await questions(sid))[1].choices.map(c => c.choice_id).join() === originalIds.join(), 'Oversized question edit leaves original choices unchanged')
  const added = await service(page, 'createQuestion', [{ survey_id: sid, question_text: 'Choose another service', question_type: 'multiple_choice', choices: ['Keep me', 'Remove me', '  '] }])
  check(added.message === 'Question added.' && added.data.questions.length === 5, 'Question creation through JS service')
  const extra = added.data.questions.at(-1)
  const edited = await service(page, 'updateQuestion', [{ survey_id: sid, question_id: extra.question_id, question_text: 'Choose another service', question_type: 'multiple_choice',
    existing_choices: { [extra.choices[0].choice_id]: 'Kept and corrected', [extra.choices[1].choice_id]: '' }, new_choices: ['New choice', ' '] }])
  const editedChoices = edited.data.questions.at(-1).choices
  check(editedChoices.length === 2 && editedChoices[0].choice_id === extra.choices[0].choice_id && editedChoices[1].choice_id !== extra.choices[1].choice_id, 'Clear deletes selected choice; addition allocates a fresh ID')
  check(!(await db.doc(`surveys/${sid}/questions/${extra.question_id}/choices/${extra.choices[1].choice_id}`).get()).exists, 'Cleared choice physically removed')
  const switched = await service(page, 'updateQuestion', [{ survey_id: sid, question_id: extra.question_id, question_text: 'Do you want another visit', question_type: 'yesno', existing_choices: {}, new_choices: [] }])
  check(switched.data.questions.at(-1).choices.length === 0 && (await db.collection(`surveys/${sid}/questions/${extra.question_id}/choices`).get()).empty, 'Switching type removes all prior choices')
  for (const direction of ['down', 'up']) check((await api('questionMove', { survey_id: sid, qid: direction === 'down' ? extra.question_id : qs[0].question_id, move: direction })).ok, 'Boundary moves are safe no-ops')
  const concurrent = await Promise.all(['One concurrent question', 'Another concurrent question'].map(question_text => api('questionCreate', { survey_id: sid, question_text, question_type: 'short_answer' })))
  check(concurrent.every(r => r.ok), 'Concurrent question creates both commit')
  qs = await questions(sid); check(new Set(qs.map(q => q.question_order)).size === qs.length, 'Concurrent question creates retain unique orders')
  for (const id of [extra.question_id, ...concurrent.map(r => r.data.question_id)]) check((await service(page, 'deleteQuestion', [{ survey_id: sid, question_id: id }])).message === 'Question deleted.', 'Question deletion through service')
  qs = await questions(sid); check(qs.map(q => q.question_order).join() === '1,2,3,4', 'Question deletion resequences remaining questions')

  console.log('Checking resident compatibility and authorization')
  const resident = await signedPage('resident')
  const form = await service(resident, 'getSurvey', [sid], 'surveyService')
  check(form.data.questions.map(q => q.question_id).join() === qs.map(q => q.question_id).join(), 'Resident reads staff order and stable IDs')
  const answers = Object.fromEntries(form.data.questions.map(q => [`q${q.question_id}`, q.question_type === 'multiple_choice' ? `choice_${q.choices[0].choice_id}` : q.question_type === 'yesno' ? 'Yes' : q.question_type === 'rating' ? '4' : 'A written answer']))
  check((await service(resident, 'submitResponse', [sid, answers], 'surveyService')).redirect?.includes('?submitted='), 'Resident submits all four new question types')
  const response = db.doc(`responses/${sid}_${tag}-resident`)
  check((await response.get()).exists && (await response.collection('answers').get()).size === 4, 'All four answers stored atomically')
  check((await api('list')).data.surveys.find(s => s.survey_id === sid).response_count === 1, 'Staff response counts use Firestore')
  const previousVersion = (await db.doc(`surveys/${sid}/validation/response`).get()).data().surveyVersion
  await api('questionMove', { survey_id: sid, qid: qs[0].question_id, move: 'down' })
  check(!previousVersion.isEqual((await db.doc(`surveys/${sid}`).get()).data().updatedAt), 'Question mutation invalidates trusted required-answer metadata')
  await api('questionUpdate', { survey_id: sid, question_id: mc.question_id, question_text: 'Choose the corrected service', question_type: 'multiple_choice', existing_choices: Object.fromEntries(mc.choices.map(c => [c.choice_id, c.choice_text])), new_choices: [] })
  check((await response.collection('answers').doc(mc.question_id).get()).data().choiceId === originalIds[0], 'Existing response still references stable edited choice')
  const textQuestion = qs.find(q => q.question_type === 'short_answer')
  check((await api('questionDelete', { survey_id: sid, question_id: textQuestion.question_id })).ok, 'Answered question can be deleted as in PHP')
  check((await response.collection('answers').doc(textQuestion.question_id).get()).exists, 'Single-question delete preserves historical answer rows, matching the SQL foreign keys')
  for (const role of ['resident', 'first', 'onboarding', 'inactive', 'archived', 'unprovisioned', 'anonymous']) for (const action of ['list', 'get', 'create', 'update', 'toggle', 'delete', 'questions', 'questionCreate', 'questionUpdate', 'questionDelete', 'questionMove']) {
    const denied = await api(action, { ...defaults, id: sid, survey_id: sid, role: 'admin', uid: `${tag}-admin` }, role)
    check([401, 403].includes(denied.status), `${role} denied ${action} regardless of forged role/UID`)
  }
  check((await api('get', { id: sid }, 'admin')).ok, 'Admin can manage another staff member’s survey')
  const adminEdit = await api('update', { ...defaults, title: 'Updated community health survey', id: sid, status: 'active', createdByUid: 'forged-owner' }, 'admin')
  check(adminEdit.ok && (await db.doc(`surveys/${sid}`).get()).data().createdByUid === `${tag}-staff`, 'Admin edits preserve original creator despite forged input')
  check((await api('get', { id: 'missing-survey' })).redirect === '/staff/survey-management', 'Missing survey retains list redirect')
  for (const id of ['../users', 'bad/id', { x: 1 }]) check(!(await api('get', { id })).ok, 'Path injection refused')
  await page.goto(app + 'staff/survey-management')
  await tableRow.getByRole('button', { name: 'Delete survey' }).click(); await page.locator('#survey-confirm-modal-proceed').click()
  await page.getByRole('cell', { name: 'Updated community health survey', exact: true }).waitFor({ state: 'detached' })
  check(!(await db.doc(`surveys/${sid}`).get()).exists && !(await response.get()).exists, 'Browser survey deletion removes parent and response')
  check((await db.collection(`surveys/${sid}/questions`).get()).empty && (await response.collection('answers').get()).empty, 'Browser deletion removes nested questions and answers')

  console.log('Checking multi-batch cascade and interrupted-delete retry')
  const big = `${tag}-large`; created.add(big)
  const entries = [[`surveys/${big}`, survey({ createdByUid: `${tag}-staff`, status: 'inactive' })],
    [`surveys/${big}/management/deletion`, { title: 'Interrupted fixture', startedAt: day }],
    [`surveys/${big}/validation/response`, { firstRequiredId: '', surveyVersion: day, requiredNext: {} }]]
  for (let i = 0; i < 402; i++) {
    entries.push([`surveys/${big}/questions/q${i}`, { text: 'Question to delete', type: 'multiple_choice', order: i + 1, legacyId: null }],
      [`surveys/${big}/questions/q${i}/choices/c`, { text: 'Choice to delete', order: 0, legacyId: null }],
      [`responses/${big}_r${i}`, { surveyId: big, residentUid: `${tag}-r${i}` }],
      [`responses/${big}_r${i}/answers/q${i}`, { text: 'Answer to delete' }])
  }
  // More than one page under individual subcollections as well as parent queries.
  for (let i = 0; i < 402; i++) entries.push([`surveys/${big}/questions/q0/choices/extra${i}`, { text: 'Extra', order: i + 1, legacyId: null }], [`responses/${big}_r0/answers/extra${i}`, { text: 'Extra answer' }])
  await seed(entries)
  check((await api('toggle', { id: big })).status === 409, 'Interrupted deletion cannot be reopened through the service')
  check((await api('questionCreate', { survey_id: big, question_text: 'Blocked concurrent edit' })).status === 409, 'Interrupted deletion refuses new questions')
  check((await service(page, 'deleteSurvey', [big])).ok, 'Staff resumes interrupted cascade across 2,415 documents')
  const remaining = await snapshot()
  check(![...remaining.keys()].some(path => path.startsWith(`surveys/${big}`) || path.startsWith(`responses/${big}_`)), 'No parent, choices, questions, responses, answers or metadata remain after paged cascade')
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(app + 'staff/add-survey'); await page.locator('#survey-builder-form').waitFor()
  check(await page.locator('#survey-builder-form').isVisible(), 'Existing survey builder renders on a phone')
  check(diagnostics.length === 0, `No legacy data requests, production requests or browser exceptions: ${diagnostics.join('; ')}`)
} finally {
  await browser?.close(); dev?.stop()
  // Clean only this run’s synthetic descendants, even if a check failed early.
  const current = await snapshot()
  const paths = [...current.keys()].filter(path => path.includes(tag) || [...created].some(sid => path.startsWith(`surveys/${sid}`) || path.startsWith(`responses/${sid}_`)))
  for (let i = 0; i < paths.length; i += 400) { const batch = db.batch(); paths.slice(i, i + 400).forEach(path => batch.delete(db.doc(path))); await batch.commit() }
  for (const uid of identities) await auth.deleteUser(uid)
  check(isDeepStrictEqual(await snapshot(), original), 'All pre-existing emulator documents unchanged')
  console.log(`PASS: ${checks} staff survey emulator/browser checks`)
  console.log(`Preserved ${original.size} original documents; cleaned synthetic fixtures only.`)
  await db.terminate(); await deleteApp(admin)
}
