import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { accounts as a, tokens as t, users as u, profiles as p, checks, project, config, base, day, date, value, write as w, remove as del, call, commit, get, ok, denied as no, person, household, survey, answer, response, proposal, request, pointer, setup } from './firestore-fixtures.mjs'
import { responseSchema } from './firestore-fixtures.mjs'
before(setup)
const update = ['updatedAt']
const created = ['createdAt', 'updatedAt']

test('anonymous, missing-profile, disabled, archived and first-login access', async () => {
  for (const role of [undefined, 'unprovisioned', 'inactive', 'archived', 'first', 'onboarding']) await no(get('surveys/open', role))
  await no(get(`users/${a.resident}`)); await ok(get(`users/${a.first}`, 'first')); await no(get(`residents/${a.first}`, 'first'))
})

test('role authority and cross-account isolation', async () => {
  await ok(get(`residents/${a.resident}`, 'resident')); await no(get(`residents/${a.other}`, 'resident'))
  await no(get(`users/${a.other}`, 'resident')); await ok(get(`residents/${a.resident}`, 'staff'))
  await no(get(`staff/${a.admin}`, 'staff')); await ok(get(`staff/${a.staff}`, 'admin'))
})

test('self-contact only, required fields, types, length and unknown-field checks', async () => {
  const path = `residents/${a.resident}`
  await ok(commit(t.resident, [w(path, { ...p.resident, contact: { email: 'fixture@example.invalid', number: '+63 9000000000' } }, update)]))
  for (const delta of [{ name: { ...person(), firstName: 'Changed' } }, { contact: { email: 5, number: '' } }, { contact: { email: 'a'.repeat(101), number: '' } }, { extraData: true }, { household: null }]) await no(commit(t.resident, [w(path, { ...p.resident, ...delta }, update)]))
  const missing = { ...p.resident }; delete missing.contact; await no(commit(t.resident, [w(path, missing, update)]))
})

test('no self-escalation, own onboarding clearance, forged UID or creation-time edit', async () => {
  for (const role of ['resident', 'staff', 'first', 'onboarding', 'admin']) await no(commit(t[role], [w(`users/${a[role]}`, { ...u[role], isFirstLogin: false, role: 'admin' }, update)]))
  await no(commit(t.staff, [w(`users/${a.other}`, { ...u.other, role: 'staff' }, update)]))
  await no(commit(t.staff, [w(`residents/${a.resident}`, { ...p.resident, uid: a.other }, update)]))
  await no(commit(t.staff, [w(`residents/${a.resident}`, { ...p.resident, createdAt: day }, update)]))
})

test('inclusive Manila dates, closed surveys and query authorization', async () => {
  await ok(get('surveys/open', 'resident'))
  for (const sid of ['past', 'future', 'inactive']) await no(get(`surveys/${sid}`, 'resident'))
  await ok(get('surveys/inactive', 'staff'))
  await no(call(`${base}:runQuery`, t.resident, { structuredQuery: { from: [{ collectionId: 'surveys' }] } }))
  const filters = [['status', 'EQUAL', 'active'], ['startDate', 'LESS_THAN_OR_EQUAL', day], ['endDate', 'GREATER_THAN_OR_EQUAL', day]].map(([f, op, v]) => ({ fieldFilter: { field: { fieldPath: f }, op, value: value(v) } }))
  await ok(call(`${base}:runQuery`, t.resident, { structuredQuery: { from: [{ collectionId: 'surveys' }], where: { compositeFilter: { op: 'AND', filters } }, orderBy: [{ field: { fieldPath: 'endDate' }, direction: 'ASCENDING' }, { field: { fieldPath: 'startDate' }, direction: 'ASCENDING' }] } }))
})

test('an interrupted cascade cannot be reopened or changed through worker SDK operations', async () => {
  const sid = 'deleting-fixture', path = `surveys/${sid}`
  const revise = () => ({ ...w(path, {}, update), updateMask: { fieldPaths: [] } })
  const question = { text: 'Choose a service', type: 'multiple_choice', order: 1, legacyId: null }
  const choice = { text: 'Fixture option', order: 1, legacyId: null }
  await ok(commit('owner', [w(path, survey({ status: 'inactive' })), w(`${path}/questions/mc`, question),
    w(`${path}/questions/mc/choices/c`, choice), w(`${path}/management/deletion`, { title: 'Fixture', startedAt: day })]))
  for (const role of ['staff', 'admin']) {
    await no(commit(t[role], [w(path, survey(), update)]))
    await no(commit(t[role], [del(path)]))
    await no(commit(t[role], [revise(), w(`${path}/questions/new`, question)]))
    await no(commit(t[role], [revise(), w(`${path}/questions/mc`, { ...question, text: 'Changed question' })]))
    await no(commit(t[role], [revise(), del(`${path}/questions/mc`)]))
    await no(commit(t[role], [revise(), w(`${path}/questions/mc/choices/new`, choice)]))
    await no(commit(t[role], [revise(), w(`${path}/questions/mc/choices/c`, { ...choice, text: 'Changed choice' })]))
    await no(commit(t[role], [revise(), del(`${path}/questions/mc/choices/c`)]))
    await no(commit(t[role], [del(`${path}/management/deletion`)]))
  }
  await no(get(path, 'resident'))
})

test('account saga locks refuse protected SDK access while keeping own lifecycle metadata readable', async () => {
  for (const role of ['resident', 'staff', 'admin']) {
    const lock = `accountLocks/${a[role]}`
    try {
      await ok(commit('owner', [w(lock, { operationPath: 'accountOperations/fixture' })]))
      await no(get('surveys/open', role))
      await ok(get(`users/${a[role]}`, role))
      await no(get(`${role === 'resident' ? 'residents' : 'staff'}/${a[role]}`, role))
      await no(get(lock, role)); await no(commit(t[role], [del(lock)]))
      if (role === 'resident') await no(commit(t[role], [w(`residents/${a[role]}`,
        { ...p.resident, contact: { email: '', number: '09000000000' } }, update)]))
      else await no(commit(t[role], [w(`surveys/locked-${role}`,
        survey({ createdByUid: a[role] }), created)]))
    } finally { await ok(commit('owner', [del(lock)])) }
    await ok(get('surveys/open', role))
  }
})

test('one response requires correct pair ID and a valid atomic first answer', async () => {
  const rid = `open_${a.resident}`
  await no(commit(t.resident, [w(`responses/${rid}`, response(a.resident), ['submittedAt'])]))
  await no(commit(t.resident, [w('responses/random', response(a.resident), ['submittedAt']), w('responses/random/answers/rating', answer())]))
  await no(commit(t.resident, [w(`responses/open_${a.other}`, response(a.other), ['submittedAt']), w(`responses/open_${a.other}/answers/rating`, answer())]))
  await no(commit(t.resident, [w(`responses/${rid}`, response(a.resident), ['submittedAt']), w(`responses/${rid}/answers/rating`, answer('rating', { rating: 6 }))]))
  await ok(commit(t.resident, [w(`responses/${rid}`, response(a.resident), ['submittedAt']), w(`responses/${rid}/answers/rating`, answer())]))
  await ok(get(`responses/${rid}/answers/rating`, 'resident')); await no(get(`responses/${rid}/answers/rating`, 'other')); await ok(get(`responses/${rid}/answers/rating`, 'staff'))
})

test('no duplicate, late or changed answer; no resident deletion or staff forgery', async () => {
  const rid = `open_${a.resident}`
  for (const writes of [[w(`responses/${rid}`, response(a.resident), ['submittedAt'])], [w(`responses/${rid}/answers/rating`, answer())], [w(`responses/${rid}/answers/late`, answer('late'))], [del(`responses/${rid}`)]]) await no(commit(t.resident, writes))
  await no(commit(t.staff, [w(`responses/open_${a.other}`, response(a.other), ['submittedAt']), w(`responses/open_${a.other}/answers/rating`, answer())]))
  for (const sid of ['past', 'future', 'inactive']) await no(commit(t.other, [w(`responses/${sid}_${a.other}`, response(a.other, sid), ['submittedAt']), w(`responses/${sid}_${a.other}/answers/rating`, answer())]))
})

test('request and pending pointer atomicity, duplicates and owner scoping', async () => {
  const req = request('nameAddress', a.resident, proposal())
  await no(commit(t.resident, [w('nameAddressRequests/change', req, ['requestedAt'])]))
  await ok(commit(t.resident, [w('nameAddressRequests/change', req, ['requestedAt']), w(`pendingRequests/${a.resident}_nameAddress`, pointer(a.resident, 'nameAddress', 'change'))]))
  await no(commit(t.resident, [w('nameAddressRequests/duplicate', req, ['requestedAt']), w(`pendingRequests/${a.resident}_nameAddress`, pointer(a.resident, 'nameAddress', 'duplicate'))]))
  await no(commit(t.resident, [del(`pendingRequests/${a.resident}_nameAddress`)])); await no(get('nameAddressRequests/change', 'other'))
})

test('family proposal entries are typed and frozen; no self-edited/orphan family rows', async () => {
  const req = request('family', a.other, household(), { firstReferenceId: 'reference' })
  const row = { person: person(), displayOrder: 0, createdAt: date, legacyId: null }
  await ok(commit(t.other, [w('familyRequests/family', req, ['requestedAt']), w(`pendingRequests/${a.other}_family`, pointer(a.other, 'family', 'family')), w('familyRequests/family/characterReferences/reference', row, ['createdAt'])]))
  await no(commit(t.other, [w('familyRequests/family/children/late', row, ['createdAt'])]))
  await no(commit(t.resident, [w(`residents/${a.resident}/children/hijack`, row, ['createdAt'])]))
  await no(commit(t.staff, [w('residents/missing/children/orphan', row, ['createdAt'])]))
})

test('all answer types validate owned choices and are immutable after submission', async () => {
  await ok(commit('owner', [w('surveys/open/questions/choice', { text: 'Fixture choice', type: 'multiple_choice', order: 2, legacyId: null }), w('surveys/open/questions/choice/choices/yes', { text: 'Chosen', order: 1, legacyId: null }), w('surveys/open/questions/text', { text: 'Fixture text', type: 'short_answer', order: 3, legacyId: null }), w('surveys/open/questions/yesno', { text: 'Fixture yesno', type: 'yesno', order: 4, legacyId: null })]))
  const rid = `open_${a.other}`, parent = w(`responses/${rid}`, response(a.other), ['submittedAt'])
  await ok(commit('owner', [w('surveys/open/validation/response', responseSchema(['rating', 'choice', 'yesno']))]))
  const first = w(`responses/${rid}/answers/rating`, answer())
  const choice = answer('choice', { type: 'multiple_choice', questionText: 'Fixture choice', choiceId: 'yes', choiceText: 'Chosen', rating: null, order: 2 })
  await no(commit(t.other, [parent, first, w(`responses/${rid}/answers/choice`, { ...choice, choiceId: 'not-owned' })]))
  await no(commit(t.other, [parent, first, w(`responses/${rid}/answers/choice`, { ...choice, extra: true })]))
  await ok(commit(t.other, [parent, first, w(`responses/${rid}/answers/choice`, choice), w(`responses/${rid}/answers/text`, answer('text', { type: 'short_answer', questionText: 'Fixture text', rating: null, text: 'Example response', order: 3 })), w(`responses/${rid}/answers/yesno`, answer('yesno', { type: 'yesno', questionText: 'Fixture yesno', rating: null, text: 'Yes', order: 4 }))]))
})

test('missing own response and pending slots are readable without exposing another owner', async () => {
  assert.equal((await get(`responses/future_${a.resident}`, 'resident')).status, 404)
  assert.equal((await get(`pendingRequests/${a.resident}_staff`, 'resident')).status, 404)
  await no(get(`responses/future_${a.admin}`, 'resident'))
  await no(get(`pendingRequests/${a.admin}_nameAddress`, 'resident'))
})
test('all raw administrative SDK writes are denied so trusted lifecycle and cascade policies cannot be bypassed', async () => {
  const operations = [
    w(`users/${a.other}`, { ...u.other, isActive: false }, update),
    w(`users/${a.archived}`, { ...u.archived, deletedAt: null }, update),
    del(`users/${a.archived}`),
    w('counters/residentNumbers', { value: 2, lastUid: a.unprovisioned }, update),
    w(`residents/${a.other}`, { ...p.other, residencyStatus: 'permanent' }, update),
    del(`residents/${a.archived}`),
    w(`staff/${a.staff}`, { ...p.staff, contact: { email: '', number: '09000000000' } }, update),
    w(`profileImages/${a.resident}`, { ownerUid: a.resident, mimeType: 'image/jpeg', base64: '/9j/abcd' }, update),
    w('surveys/open', survey({ status: 'inactive' }), update), del('surveys/open'),
    w('surveys/new', survey(), created),
    w('surveys/open/questions/new', { text: 'Forged definition', type: 'rating', order: 4, legacyId: null }),
    del('surveys/open/questions/rating'),
    w('surveys/open/questions/rating/choices/new', { text: 'Forged option', order: 1, legacyId: null }),
    w('surveys/open/validation/response', { surveyVersion: date, firstRequiredId: '', requiredNext: {} }),
    w('residencyRecords/forged', { residentUid: a.other, toStatus: 'permanent' }),
    w('nameAddressRequests/change', { status: 'approved' }),
    w('familyRequests/family', { status: 'approved' }),
    w('staffRequests/forged', { status: 'approved' }),
    w('deletionRequests/forged', { status: 'approved' }),
    w('accountLocks/forged', { operationPath: 'accountOperations/forged' }),
    w('accountOperations/forged', { state: 'complete' }),
    w('loginHistory/forged', { actorUid: a.admin }),
    w('identifierAliases/forged', { uid: a.admin }),
  ]
  for (const role of ['resident', 'staff', 'admin']) for (const operation of operations) await no(commit(t[role], [operation]))
  for (const role of ['resident','staff','admin']) for (const path of ['accountLocks/forged','accountOperations/forged','identifierAliases/private']) await no(get(path, role))
  await no(get('loginHistory/trusted','staff')); await ok(get('loginHistory/trusted','admin'))
})

test('UI/Hosting are reachable, built JS is served and rule coverage is available', async () => {
  assert.equal((await fetch('http://127.0.0.1:4000/')).status, 200)
  const r = await fetch('http://127.0.0.1:5000/login'), html = await r.text(); assert.equal(r.status, 200)
  const asset = html.match(/src="([^"]+\.js)"/)[1], js = await fetch(`http://127.0.0.1:5000${asset}`)
  assert.equal(js.status, 200); assert(js.headers.get('content-type').includes('javascript'))
  assert.equal((await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${project}:ruleCoverage`)).status, 200)
  assert.equal(config.hosting.public, 'frontend/dist')
  console.log(`PASS: ${checks} Auth/Firestore assertions; UI, Hosting assets and coverage verified; local project ${project}.`)
})
