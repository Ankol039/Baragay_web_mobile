import assert from 'node:assert/strict'
import test from 'node:test'
import { importFirestore } from '../src/import.mjs'
import { reportMarkdown, GROUPS, SQL_GROUPS } from '../src/verify.mjs'
function database(initial = []) {
  const data = new Map(initial), activity = { creates: 0, updates: 0 }
  const doc = path => ({ path })
  const snapshot = ref => ({ exists: data.has(ref.path), data: () => data.get(ref.path) })
  return { data, activity, doc, getAll: async (...refs) => refs.map(snapshot),
    batch: () => { const jobs = []; return { create: (ref, value) => jobs.push([ref.path, value]), commit: async () => { for (const [key, value] of jobs) { assert(!data.has(key)); data.set(key, value); activity.creates++ } } } },
    runTransaction: async fn => fn({ get: async ref => snapshot(ref), create: (ref, value) => { data.set(ref.path, value); activity.creates++ }, update: (ref, value) => { data.set(ref.path, { ...data.get(ref.path), ...value }); activity.updates++ } }) }
}
test('writes only missing records; rerun preserves values and higher counters', async () => {
  const db = database([['counters/residentNumbers', { value: 99 }]])
  const plan = { records: [{ path: 'users/example', data: { a: 1, b: 2 } }, { path: 'counters/residentNumbers', data: { value: 4 } }] }
  assert.equal((await importFirestore(db, plan)).written, 1)
  db.data.set('users/example', { b: 2, a: 1 })
  assert.equal((await importFirestore(db, plan)).written, 0)
  assert.equal(db.data.get('counters/residentNumbers').value, 99)
  assert.equal(db.activity.updates, 0)
})
test('conflicting existing record aborts entire preflight before new document writes', async () => {
  const db = database([['users/conflict', { a: 2 }]])
  const plan = { records: [{ path: 'users/new', data: { a: 1 } }, { path: 'users/conflict', data: { a: 1 } }] }
  await assert.rejects(importFirestore(db, plan), e => e.code === 'TARGET_DOCUMENT_CONFLICT')
  assert.equal(db.activity.creates, 0)
})
test('public verification formatter prints allowlisted counts only', () => {
  const groups = Object.fromEntries(GROUPS.map(g => [g, { expected: 0, actual: 0 }]))
  const result = { passed: true, dryRun: true, capturedAt: '2026-11-10T00:00:00Z', groups,
    sourceCounts: Object.fromEntries(Object.keys(SQL_GROUPS).map(k => [k, 0])), exactDocuments: 0,
    relations: { responsesChecked: 0, responseOrphans: 0, questionsChecked: 0, questionOrphans: 0, choicesChecked: 0, choiceOrphans: 0, answersChecked: 0, answerOrphans: 0, peopleChecked: 0, peopleOrphans: 0 },
    authCount: 0, authSummary: {}, warnings: {}, counters: { residentNumbers: 0, staffNumbers: 0 }, temporaryLoginChecks: 0,
    privateAccount: { email: 'never-show@example.invalid', passwordHash: 'never-show-hash', uid: 'never-show-uid' } }
  const text = reportMarkdown(result)
  assert(!text.includes('never-show'))
  assert(text.includes('Asia/Manila'))
  assert.equal((text.match(/\| PASS \|/g) || []).length, 15)
})
