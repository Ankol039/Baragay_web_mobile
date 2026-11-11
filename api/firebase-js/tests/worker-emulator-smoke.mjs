import assert from 'node:assert/strict'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const project = JSON.parse(await readFile(new URL('../../../.firebaserc', import.meta.url), 'utf8')).projects.default
assert.equal(project, 'barangay-survey-1cc7d', 'Use only the approved project emulator')
process.env.GCLOUD_PROJECT = project
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const fixtures = await import('../../../frontend/tests/firestore-fixtures.mjs')
const { base, call, commit, write, remove, user, residentProfile, staffProfile, day, date } = fixtures
const workerBase = process.env.BSS_WORKER_EMULATOR_URL || 'http://127.0.0.1:8798'
assert.equal(new URL(workerBase).hostname, '127.0.0.1', 'Worker must be local')
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const tag = `js-worker-${randomUUID()}`
const docs = new Set()
const identities = []
const check = (condition, message) => assert.ok(condition, message)
const residentNumberCounterPath = 'counters/residentNumbers'
let originalCounter = null
let counterWasChanged = false
let registrationOperationPath = ''
let registeredUid = ''
async function api(path, body = null, method = body ? 'POST' : 'GET', headers = {}) {
  const response = await fetch(workerBase + path, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let payload = null
  if (response.status !== 204) {
    try { payload = await response.json() } catch { throw new Error(`Worker returned non-JSON for ${path}`) }
  }
  return { status: response.status, ok: response.ok, payload }
}
async function seed(path, data) {
  const response = await commit('owner', [{ ...write(path, data), currentDocument: { exists: false } }])
  check(response.ok, `Could not create emulator fixture ${path}`)
  docs.add(path)
}
async function createIdentity(role) {
  const email = `${tag}-${role}@example.invalid`, password = 'FixturePass8'
  const created = await call(`${authBase}/accounts:signUp?key=emulator-only`, null, { email, password, returnSecureToken: true })
  check(created.ok, `Could not create ${role} emulator identity`)
  identities.push({ uid: created.body.localId, idToken: created.body.idToken })
  return identities.at(-1)
}
async function collection(parent, collectionId) {
  const url = `${base}${parent ? '/' + parent : ''}:runQuery`
  const result = await call(url, 'owner', { structuredQuery: { from: [{ collectionId }] } })
  check(result.ok, `Could not list emulator ${collectionId}`)
  return result.body.filter(row => row.document).map(row => ({
    id: row.document.name.split('/').at(-1),
    path: row.document.name.slice(row.document.name.indexOf('/documents/') + '/documents/'.length),
  }))
}
let surveyId = ''
try {
  check((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Firebase emulators are running')

  const allowed = await api('/api/firebase/accounts.php', null, 'OPTIONS', {
    Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type',
  })
  check(allowed.status === 204, 'Worker allows the configured web development origin')
  check(allowed.payload?.ok !== false, 'Allowed preflight does not return an API error')
  const blocked = await api('/api/firebase/accounts.php', null, 'OPTIONS', { Origin: 'https://outside.example' })
  check(blocked.status === 403, 'Worker refuses an unlisted browser origin')

  const rules = await api('/api/firebase/index.php?action=rules')
  check(rules.ok && rules.payload.ok && Array.isArray(rules.payload.data), 'Auth policy endpoint responds through the JavaScript Worker')
  const fields = await api('/api/firebase/accounts.php', { action: 'registrationFields' }, 'POST')
  check(fields.ok && fields.payload.ok && fields.payload.data.fields.person, 'Registration metadata responds through the JavaScript Worker')
  const unauthorized = await api('/api/firebase/resident-read.php', { action: 'history' }, 'POST')
  check(unauthorized.status === 401 && unauthorized.payload.message === 'Please sign in to continue.', 'Protected resident API requires a Firebase token')

  const resident = await createIdentity('resident')
  const residentEmail = `${tag}-resident@example.invalid`
  const residentNumber = `R-2026-${String(randomInt(10000)).padStart(4, '0')}`
  const aliasPath = `identifierAliases/residentNumber_${createHash('sha256').update(residentNumber.toLowerCase()).digest('hex')}`
  await seed(`users/${resident.uid}`, user(resident.uid, 'resident', { identifier: residentNumber }))
  await seed(`residents/${resident.uid}`, residentProfile(resident.uid))
  await seed(aliasPath, { kind: 'residentNumber', normalizedIdentifier: residentNumber.toLowerCase(), uid: resident.uid, authEmail: residentEmail })
  const alias = await api('/api/firebase/index.php?action=resolve', { identifier: residentNumber, password: 'FixturePass8' }, 'POST')
  check(alias.ok && alias.payload.data.email === residentEmail, 'Identifier resolver uses Firebase Auth and Firestore alias data')
  const profile = await api('/api/firebase/resident-profile.php', { action: 'get', idToken: resident.idToken }, 'POST')
  check(profile.ok && profile.payload.data.resident.resident_number === residentNumber, 'Resident profile read uses the verified token UID')
  const savedContact = await api('/api/firebase/resident-profile.php', {
    action: 'contact', idToken: resident.idToken, email: 'worker@example.invalid', contact_number: '09171234567',
  }, 'POST')
  check(savedContact.ok && savedContact.payload.data.resident.email === 'worker@example.invalid', 'Resident contact update commits through the JavaScript boundary')
  const history = await api('/api/firebase/resident-read.php', { action: 'history', idToken: resident.idToken }, 'POST')
  check(history.ok && history.payload.data.surveys, 'Resident history read succeeds through the JavaScript boundary')

  originalCounter = await call(`${base}/${residentNumberCounterPath}`, 'owner', null, 'GET')
  const sequence = 9000 + randomInt(900)
  const issuedNumber = `R-2026-${String(sequence + 1).padStart(4, '0')}`
  const issuedAlias = `identifierAliases/residentNumber_${createHash('sha256').update(issuedNumber.toLowerCase()).digest('hex')}`
  const aliasCollision = await call(`${base}/${issuedAlias}`, 'owner', null, 'GET')
  assert.equal(aliasCollision.status, 404, 'Synthetic registration number is unused')
  const operationId = randomUUID()
  registrationOperationPath = `accountOperations/${createHash('sha256').update(`public:${operationId}`).digest('hex')}`
  docs.add(registrationOperationPath)
  counterWasChanged = true
  check((await commit('owner', [write(residentNumberCounterPath, { value: sequence, lastUid: null, updatedAt: date })])).ok,
    'Test-only resident sequence saved in the emulator')
  const registration = await api('/api/firebase/accounts.php', {
    action: 'registerResident', operationId,
    values: {
      password: 'FixturePass8', confirm_password: 'FixturePass8', first_name: 'Worker', middle_name: 'Synthetic', last_name: 'Resident',
      name_extension: '', courtesy_title: '', courtesy_title_other: '', gender: 'man', birthdate: '1990-01-01',
      birthplace: 'San Ildefonso', email: '', contact_number: '', household_number: '1', purok: '', street_highway: '',
      barangay: 'Anyatam', municipality: 'San Ildefonso', postal_code: '', province: 'Bulacan', residency_status: 'permanent',
      residence_type: '', special_category: 'none', category_reference: '', residency_start_date: '2020-01-01',
      occupation: '', hotline_number: '', is_married: '0', has_children: '0', references: [{ first_name: 'Fixture', last_name: 'Reference' }],
      children: [],
    },
  }, 'POST')
  check(registration.ok && registration.payload.data.resident_number === issuedNumber,
    `Public resident registration provisions Auth and Firestore through the Worker (${registration.status}: ${JSON.stringify(registration.payload)})`)
  registeredUid = registration.payload.data.uid
  const registeredLogin = await api('/api/firebase/index.php?action=resolve', { identifier: issuedNumber, password: 'FixturePass8' }, 'POST')
  check(registeredLogin.ok && registeredLogin.payload.data.email === issuedNumber.toLowerCase() + '@barangay.app', 'Provisioned Resident Number resolves to its Firebase Auth account')
  docs.add(`users/${registeredUid}`)
  docs.add(`residents/${registeredUid}`)
  docs.add(issuedAlias)
  docs.add(registrationOperationPath)
  for (const collectionId of ['children', 'characterReferences']) {
    for (const row of await collection(`residents/${registeredUid}`, collectionId)) docs.add(row.path)
  }

  const dayString = day.toISOString().slice(0, 10)
  surveyId = `${tag}-schema`
  await seed(`surveys/${surveyId}`, { title: 'Schema verification survey', description: '', startDate: day, endDate: day, status: 'active', updatedAt: date })
  await seed(`surveys/${surveyId}/questions/required-question`, { text: 'Describe this service?', type: 'short_answer', required: true, order: 1, legacyId: null })
  const schema = await api('/api/firebase/survey-schema.php', { action: 'prepare', surveyId, idToken: resident.idToken }, 'POST')
  check(schema.ok && schema.payload.data.ready, `Survey schema prepares for Manila day ${dayString}`)
  docs.add(`surveys/${surveyId}/validation/response`)

  const staff = await createIdentity('staff')
  await seed(`users/${staff.uid}`, user(staff.uid, 'staff', { username: `${tag}.staff` }))
  await seed(`staff/${staff.uid}`, { ...staffProfile(staff.uid), createdByUid: staff.uid })
  const report = await api('/api/firebase/staff-reports.php', { action: 'dashboard', idToken: staff.idToken }, 'POST')
  check(report.ok && report.payload.data && Number.isInteger(report.payload.data.total_surveys), 'Read-only staff report uses one Firestore snapshot')
  const createdSurvey = await api('/api/firebase/staff-surveys.php', {
    action: 'create', idToken: staff.idToken, title: 'Community health questionnaire',
    description: 'A short emulator route verification description.', start_date: dayString,
    end_date: new Date(day.getTime() + 7 * 86400000).toISOString().slice(0, 10),
    questions: [{ text: 'How can the health center improve this service?', type: 'short_answer' }],
  }, 'POST')
  check(createdSurvey.ok && createdSurvey.payload.data.survey_id, 'Staff can create a survey through the Worker')
  const createdId = createdSurvey.payload.data.survey_id
  const createdQuestions = await collection(`surveys/${createdId}`, 'questions')
  docs.add(`surveys/${createdId}`)
  for (const question of createdQuestions) {
    docs.add(question.path)
    for (const choice of await collection(question.path, 'choices')) docs.add(choice.path)
  }

  const auditOperation = randomUUID()
  for (const event of ['login', 'logout']) {
    const written = await api(`/api/firebase/index.php?action=${event}`, { operationId: auditOperation, idToken: resident.idToken }, 'POST')
    check(written.ok && written.payload.ok, `Auth ${event} audit succeeds through the Worker`)
    docs.add(`loginHistory/auth_${createHash('sha256').update(`${resident.uid}:${event}:${auditOperation}`).digest('hex')}`)
  }
  console.log('PASS: JavaScript Worker emulator smoke checks completed; all Firebase writes were scoped to synthetic fixtures.')
} finally {
  if (registrationOperationPath) {
    const operation = await call(`${base}/${registrationOperationPath}`, 'owner', null, 'GET')
    registeredUid ||= operation.body?.fields?.uid?.stringValue || ''
  }
  if (registeredUid) {
    const deleted = await call(`${authBase}/projects/${project}/accounts:delete`, 'owner', { localId: registeredUid })
    assert.ok(deleted.ok || deleted.body?.error?.message === 'USER_NOT_FOUND', 'Synthetic registration Auth identity was removed')
  }
  const surveyDocs = []
  for (const path of docs) if (path.startsWith('surveys/')) surveyDocs.push(remove(path))
  const otherDocs = [...docs].filter(path => !path.startsWith('surveys/')).map(remove)
  if (surveyDocs.length + otherDocs.length) {
    const cleaned = await commit('owner', [...surveyDocs, ...otherDocs])
    assert.ok(cleaned.ok, 'Synthetic Firestore fixtures were removed')
  }
  if (counterWasChanged) {
    if (originalCounter?.ok) {
      const resource = `${base.slice(base.indexOf('/projects/') + 1)}/${residentNumberCounterPath}`
      const restored = await commit('owner', [{ update: { name: resource, fields: originalCounter.body.fields } }])
      assert.ok(restored.ok, 'Original emulator registration counter was restored')
    } else {
      assert.ok((await commit('owner', [remove(residentNumberCounterPath)])).ok, 'Temporary emulator registration counter was removed')
    }
  }
  for (const identity of identities.reverse()) {
    const removed = await call(`${authBase}/accounts:delete?key=emulator-only`, null, { idToken: identity.idToken })
    assert.ok(removed.ok, 'Synthetic Auth identity was removed')
  }
}
