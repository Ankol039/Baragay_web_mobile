// Pure JavaScript: shared by the web service/form and the future mobile app.
export const MAX_ANSWER_LENGTH = 20000
export const responseMessages = {
  empty: 'Nothing was submitted, so your answers were not saved and this survey is still open to you. Please answer at least one question before submitting.',
  failed: 'Something went wrong while saving your answers. Nothing was recorded, so you can safely try again.',
  required: 'Please answer all required questions before submitting.',
  invalid: 'Please answer all required questions before submitting.',
  length: `Text answers must be ${MAX_ANSWER_LENGTH.toLocaleString('en-US')} characters or fewer.`,
}
export const questionRequired = question => question.required ?? question.type !== 'short_answer'
// PHP trim() semantics. The emulator's Rules size() uses UTF-16 units, like JS length.
const trim = value => value.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '')
export function validateResponse(questions, input = {}) {
  const answers = [], missing = [], invalid = []
  let code = ''
  for (const question of questions) {
    const raw = input[`q${question.id}`] ?? ''
    if (raw === '' || raw === null || (typeof raw === 'string' && trim(raw) === '')) {
      if (questionRequired(question)) missing.push(`q${question.id}`)
      continue
    }
    const answer = { questionId: question.id, type: question.type, questionText: question.text,
      choiceId: null, choiceText: '', rating: null, text: '', order: question.order, legacyId: null }
    let valid = typeof raw === 'string' || typeof raw === 'number'
    if (question.type === 'multiple_choice') {
      const choice = question.choices?.find(choice => `choice_${choice.id}` === raw)
      valid = Boolean(choice)
      if (choice) { answer.choiceId = choice.id; answer.choiceText = choice.text }
    } else if (question.type === 'yesno') {
      valid = ['Yes', 'No'].includes(raw)
      if (valid) answer.text = raw
    } else if (question.type === 'rating') {
      valid = (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 5) || (typeof raw === 'string' && /^[1-5]$/.test(raw))
      if (valid) answer.rating = Number(raw)
    } else if (question.type === 'short_answer' && typeof raw === 'string') {
      answer.text = trim(raw)
      valid = answer.text.length <= MAX_ANSWER_LENGTH
      if (!valid) code = 'length'
    } else valid = false
    if (valid) answers.push(answer)
    else invalid.push(`q${question.id}`)
  }
  if (!code) code = invalid.length ? 'invalid' : !answers.length ? 'empty' : missing.length ? 'required' : ''
  return { valid: !code, code, message: responseMessages[code] || '', missing, invalid, answers }
}
