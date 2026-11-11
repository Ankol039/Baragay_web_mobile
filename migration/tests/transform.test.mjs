import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { fixture, seal } from './fixtures.mjs'
import { transform } from '../src/transform.mjs'
import { digest } from '../src/safety.mjs'
import { pack } from '../src/storage.mjs'
import { compressAvatar } from '../src/photos.mjs'
const record = (p, path) => p.records.find(r => r.path === path).data
const code = expected => e => e.code === expected

test('all 15 source tables covered and IDs, people, requests, relations preserved', () => {
  const source = fixture(), p = transform(source)
  assert.deepEqual(p.sourceCounts, source.counts)
  assert.equal(Object.keys(p.sourceCounts).length, 15)
  assert.equal(record(p, 'users/resident-1').role, 'resident')
  assert.equal(record(p, 'users/staff-2').role, 'admin')
  assert.equal(record(p, 'surveys/10/questions/20').legacyId, 20)
  assert.equal(record(p, 'surveys/10/questions/20/choices/30').legacyId, 30)
  assert.equal(record(p, 'responses/10_resident-1').firstAnswerId, '20')
  assert.equal(record(p, 'responses/10_resident-1/answers/20').choiceId, '30')
  assert.equal(record(p, 'residents/resident-1/children/60').person.gender, 'woman')
  assert.equal(record(p, 'familyRequests/71/characterReferences/1').displayOrder, 0)
  assert.equal(record(p, 'pendingRequests/resident-1_family').requestId, '71')
  assert.equal(record(p, 'residents/resident-1').lastResidencyRecordId, '74')
  assert.equal(p.counters.residentNumbers, 9); assert.equal(p.counters.staffNumbers, 12)
  assert.equal(p.authUsers.find(a => a.uid === 'staff-2').email, 'admin@barangay.app')
  assert.equal(p.authUsers.find(a => a.uid === 'resident-1').email, 'r-2026-0009@barangay.app')
  assert(!JSON.stringify(pack(p.records)).includes(source.tables.staff[0].password))
})
test('transform is deterministic, including all timestamps and alias IDs', () => {
  assert.equal(digest(pack(transform(fixture()))), digest(pack(transform(fixture()))))
})
test('broken core foreign keys and duplicate responses/answers fail without dropping rows', () => {
  for (const [table, field, expected] of [['survey_questions', 'survey_id', 'QUESTION_WITHOUT_SURVEY'], ['responses', 'resident_id', 'RESPONSE_WITHOUT_SURVEY_OR_RESIDENT'], ['survey_results', 'choice_id', 'ANSWER_WITHOUT_OWNED_CHOICE']]) {
    const s = fixture(); s.tables[table][0][field] = 999; seal(s)
    assert.throws(() => transform(s), code(expected))
  }
  const s = fixture(); s.tables.survey_results.push({ ...s.tables.survey_results[0], answer_id: 999 }); seal(s)
  assert.throws(() => transform(s), code('DUPLICATE_DOCUMENT_OR_RELATION'))
})
test('historical orphan requests survive without inventing an Auth user', () => {
  const s = fixture(); s.tables.resident_update_requests[0].resident_id = 999; seal(s)
  const p = transform(s)
  assert.equal(p.warnings.historicalRequestOwnersMissing, 1)
  assert.equal(p.warnings.orphanPendingOwners, 1)
  assert.equal(record(p, 'nameAddressRequests/70').ownerUid, 'resident-999')
  assert(!p.authUsers.some(a => a.uid === 'resident-999'))
})
test('duplicate pending slots and case-folded username collisions stop transformation', () => {
  const s = fixture(); s.tables.resident_update_requests.push({ ...s.tables.resident_update_requests[0], request_id: 999 }); seal(s)
  assert.throws(() => transform(s), code('DUPLICATE_DOCUMENT_OR_RELATION'))
  const c = fixture(); c.tables.staff.push({ ...c.tables.staff[0], staff_id: 3, staff_number: 'S-2026-0013', username: 'admin', role: 'staff' }); seal(c)
  assert.throws(() => transform(c), code('IDENTIFIER_ALIAS_COLLISION'))
})
test('export content/count corruption is detected', () => {
  const s = fixture(); s.tables.staff[0].username = 'changed'
  assert.throws(() => transform(s), code('EXPORT_INTEGRITY_MISMATCH'))
  const c = fixture(); c.counts.staff = 999
  assert.throws(() => transform(c), code('EXPORT_COUNT_MISMATCH'))
})
test('synthetic avatar compression returns bounded JPEG without files or personal images', async () => {
  const input = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#447755' } }).png().toBuffer()
  const encoded = await compressAvatar(input), bytes = Buffer.from(encoded, 'base64')
  assert(encoded.length <= 131072); assert.equal(bytes.readUInt16BE(0), 0xffd8)
})

test('latest residency record follows event time before key order', () => {
  const s = fixture()
  s.tables.resident_residency_changes.push({ ...s.tables.resident_residency_changes[0], change_id: 999, changed_at: '2020-01-01 08:00:00' })
  const p = transform(seal(s))
  assert.equal(record(p, 'residents/resident-1').lastResidencyRecordId, '74')
})
