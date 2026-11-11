import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateResponse, questionRequired, responseMessages, MAX_ANSWER_LENGTH } from '../src/shared/validateResponse.js'

const questions = [
  { id: 'mc', type: 'multiple_choice', text: 'Choice', order: 1, choices: [{ id: 'a', text: 'A' }] },
  { id: 'yn', type: 'yesno', text: 'Yes/No', order: 2 },
  { id: 'rating', type: 'rating', text: 'Rating', order: 3 },
  { id: 'text', type: 'short_answer', text: 'Comments', order: 4 },
]
const valid = { qmc: 'choice_a', qyn: 'No', qrating: '5', qtext: '  Hello\nworld  ' }
test('normalizes all four types and optional whitespace using immutable input', () => {
  const snapshot = JSON.stringify([questions, valid])
  const result = validateResponse(questions, valid)
  assert(result.valid)
  assert.deepEqual(result.answers.map(row => [row.choiceId, row.rating, row.text]), [
    ['a', null, ''], [null, null, 'No'], [null, 5, ''], [null, null, 'Hello\nworld'],
  ])
  assert.equal(JSON.stringify([questions, valid]), snapshot)
  assert.equal(validateResponse(questions, { ...valid, qtext: ' \n\t ' }).answers.length, 3)
})
test('required questions use original type defaults and explicit required flags', () => {
  assert(questionRequired(questions[0])); assert(!questionRequired(questions[3]))
  const missing = validateResponse(questions, { qtext: 'Comment' })
  assert.equal(missing.message, 'Please answer all required questions before submitting.')
  assert.deepEqual(missing.missing, ['qmc', 'qyn', 'qrating'])
  assert(!validateResponse([{ ...questions[3], required: true }], {}).valid)
  assert(validateResponse([{ ...questions[0], required: false }, questions[3]], { qtext: 'Comment' }).valid)
})
test('all-empty input is rejected without treating zero as a blank rating', () => {
  for (const input of [{}, { qtext: ' \n\r\t\0\v ' }]) assert.equal(validateResponse(questions, input).code, 'empty')
  assert.equal(validateResponse(questions, { ...valid, qrating: 0 }).code, 'invalid')
  assert.equal(validateResponse(questions, {}).message, responseMessages.empty)
})
test('forged choices, partial numeric strings, invalid ratings and yes/no fail strictly', () => {
  for (const qmc of ['choice_foreign', 'choice_a-more', 'a', {}, ['choice_a'], 1]) assert(!validateResponse(questions, { ...valid, qmc }).valid)
  for (const qrating of ['1.0', '1oops', '0', '6', '-1', ' 5', 1.5, true, {}, NaN, Infinity]) assert(!validateResponse(questions, { ...valid, qrating }).valid)
  for (const qyn of ['yes', 'No ', true, 1, ['Yes']]) assert(!validateResponse(questions, { ...valid, qyn }).valid)
  for (const qrating of [1, 5, '1', '5']) assert(validateResponse(questions, { ...valid, qrating }).valid)
})
test('text uses the emulator UTF-16 bound, supports zero text and rejects objects', () => {
  assert(validateResponse(questions, { ...valid, qtext: '😀'.repeat(MAX_ANSWER_LENGTH / 2) }).valid)
  assert.equal(validateResponse(questions, { ...valid, qtext: '😀'.repeat(MAX_ANSWER_LENGTH / 2 + 1) }).code, 'length')
  assert.equal(validateResponse(questions, { ...valid, qtext: 'a'.repeat(MAX_ANSWER_LENGTH + 1) }).code, 'length')
  assert.equal(validateResponse(questions, { ...valid, qtext: {} }).code, 'invalid')
  assert.equal(validateResponse(questions, { ...valid, qtext: '0' }).answers.at(-1).text, '0')
  assert.equal(validateResponse([], {}).code, 'empty')
})
