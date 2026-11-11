import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateResponse, MAX_ANSWER_LENGTH } from '../src/shared/validateResponse.js'
import { collectPersonRows, editableFamily, familyPayload } from '../src/config/personFields.js'
const question = (type, extra = {}) => ({ id: 'q', text: 'Question', type, order: 1, ...extra })
test('mobile validator remains byte-identical to the shared web source', () => {
  assert.equal(readFileSync(new URL('../src/shared/validateResponse.js', import.meta.url), 'utf8'), readFileSync(new URL('../../frontend/src/shared/validateResponse.js', import.meta.url), 'utf8'))
})
test('required/empty rules, exact choice ownership, Yes/No and strict ratings', () => {
  assert.equal(validateResponse([question('short_answer')], { qq: '  \t\r\n' }).code, 'empty')
  assert.equal(validateResponse([question('rating')], {}).code, 'empty')
  assert.equal(validateResponse([question('rating'), { ...question('short_answer'), id: 'text' }], { qtext: 'Text' }).code, 'required')
  assert.equal(validateResponse([question('multiple_choice', { choices: [{ id: 'a', text: 'A' }] })], { qq: 'choice_foreign' }).code, 'invalid')
  assert.equal(validateResponse([question('multiple_choice', { choices: [{ id: 'a', text: 'A' }] })], { qq: 'choice_a' }).answers[0].choiceId, 'a')
  for (const value of ['yes', 'no', true, 1]) assert.equal(validateResponse([question('yesno')], { qq: value }).valid, false)
  for (const value of ['Yes', 'No']) assert.equal(validateResponse([question('yesno')], { qq: value }).valid, true)
  for (const value of ['1.0', '5x', ' 5 ', 0, 6, 1.1]) assert.equal(validateResponse([question('rating')], { qq: value }).valid, false)
  for (const value of [1, '5']) assert.equal(validateResponse([question('rating')], { qq: value }).valid, true)
})
test('text normalization retains PHP trim and UTF-16 size limit', () => {
  assert.equal(validateResponse([question('short_answer')], { qq: '  hello\n  ' }).answers[0].text, 'hello')
  assert.equal(validateResponse([question('short_answer')], { qq: '😀'.repeat(MAX_ANSWER_LENGTH / 2) }).valid, true)
  assert.equal(validateResponse([question('short_answer')], { qq: '😀'.repeat(MAX_ANSWER_LENGTH / 2) + 'x' }).code, 'length')
})
const spec = { courtesy_title: { options: ['Mr.'] }, first_name: {}, last_name: {}, gender: {} }
test('family collection drops empty rows and preserves ordered people/custom titles', () => {
  const input = [{ first_name: '  First ', last_name: ' Person ', courtesy_title: 'Others', courtesy_title_other: 'Engr.' }, { gender: 'man' }, { first_name: 'Second' }]
  const rows = collectPersonRows(input, spec)
  assert.deepEqual(rows.map(r => r.first_name), ['First', 'Second'])
  assert.equal(rows[0].courtesy_title, 'Engr.')
  assert.equal(familyPayload({ children: input, references: [] }, spec).children[0].courtesy_title_other, 'Engr.')
})
test('family form retains original clear-on-open semantics and request reason', () => {
  const values = editableFamily({ is_married: '0', has_children: '0', occupation: 'Teacher', children: [], references: [{ first_name: 'Reference' }] }, spec, true)
  assert.equal(values.is_married, '0'); assert.equal(values.occupation, ''); assert.equal(values.references[0].first_name, '')
  assert.equal(values.family_reason, '')
})
