import { HttpError, fail } from './core/errors.mjs'
import { today, dateOnly, phpTrim, charLength, byteLength, validWrittenText } from './policy.mjs'

const allowedActions = new Set(['list', 'get', 'create', 'update', 'toggle', 'delete', 'questions', 'questionCreate', 'questionUpdate', 'questionDelete', 'questionMove'])
const questionTypes = new Set(['multiple_choice', 'yesno', 'rating', 'short_answer'])
const idPattern = /^[A-Za-z0-9_-]{1,128}$/
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')

function ssError(message, status = 400) { throw new HttpError(message, status) }
function ssId(value) {
  if ((typeof value !== 'string' && !Number.isInteger(value)) || !idPattern.test(String(value))) ssError('Invalid request.')
  return String(value)
}
function ssText(input, key, fallback = '') {
  const value = input[key] ?? fallback
  if (typeof value !== 'string') ssError(`Invalid request field: ${key}.`)
  return value
}
function ssArray(input, key) {
  const value = input[key] ?? []
  if (!Array.isArray(value)) ssError(`Invalid request field: ${key}.`)
  return value
}
function ssType(input, key) {
  const value = ssText(input, key, 'short_answer')
  if (!questionTypes.has(value)) ssError(`Invalid request field: ${key}.`)
  return value
}
function ssChoices(input, key) {
  return ssArray(input, key).map(value => {
    if (typeof value !== 'string') ssError(`Invalid request field: ${key}.`)
    return phpTrim(value)
  })
}
function ssDate(value) {
  if (value instanceof Date) return dateOnly(value)
  return String(value ?? '').slice(0, 10)
}
function ssValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01') return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
function ssMetadata(input) {
  const title = phpTrim(ssText(input, 'title')), description = phpTrim(ssText(input, 'description'))
  const start = ssText(input, 'start_date'), end = ssText(input, 'end_date')
  if (!title || !start || !end) ssError('Title, start date, and end date are required.')
  if (!validWrittenText(title, 8)) ssError('Give the survey a real title - at least eight characters that describe what it is about.')
  if (description && !validWrittenText(description, 10)) ssError('Either write a proper description of at least ten characters, or leave it blank.')
  if (start > end) ssError('Start date cannot be after end date.')
  if (charLength(title) > 150 || byteLength(description) > 65535 || !ssValidDate(start) || !ssValidDate(end)) ssError('Invalid request.')
  return { title, description, startDate: new Date(`${start}T00:00:00.000Z`), endDate: new Date(`${end}T00:00:00.000Z`) }
}
function ssWrite(ctx, path, data, merge = false, timestamps = []) {
  return ctx.store.write(path, data, { ...(merge ? { mask: Object.keys(data) } : {}), serverTimes: timestamps })
}
function ssDelete(ctx, path) { return ctx.store.remove(path) }
async function ssQuery(ctx, parent, collection, tx = null, where = [], limit = 0, select = []) {
  return ctx.store.query({ parent, collectionId: collection,
    ...(where.length ? { where: [{ field: where[0], op: 'EQUAL', value: where[1] }] } : {}),
    ...(limit ? { limit } : {}), ...(select.length ? { select } : {}) }, tx)
}
async function ssRead(ctx, path, tx) { return ctx.store.get(path, tx) }
function ssCompareLegacy(left, right) {
  return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER)
}
function ssSortQuestions(rows) {
  return rows.sort((a, b) => (a.data.order - b.data.order) || ssCompareLegacy(a.data.legacyId, b.data.legacyId) || compareText(a.id, b.id))
}
function ssSortChoices(rows) {
  return rows.sort((a, b) => (a.data.order - b.data.order) || compareText(a.id, b.id))
}
function ssSurveyRow(id, survey) {
  return { survey_id: id, title: survey.title, description: survey.description ?? '', start_date: ssDate(survey.startDate), end_date: ssDate(survey.endDate), status: survey.status }
}
async function ssSurvey(ctx, id, tx, deleting = false) {
  const survey = await ssRead(ctx, `surveys/${id}`, tx)
  if (survey && !deleting && await ssRead(ctx, `surveys/${id}/management/deletion`, tx)) ssError('The request could not be completed. Please try again.', 409)
  return survey
}
async function ssQuestions(ctx, surveyId, tx = null) {
  const questions = ssSortQuestions(await ssQuery(ctx, `surveys/${surveyId}`, 'questions', tx))
  for (const question of questions) question.choices = ssSortChoices(await ssQuery(ctx, `surveys/${surveyId}/questions/${question.id}`, 'choices', tx))
  return questions
}
function ssQuestionRows(questions) {
  return questions.map(question => ({ question_id: question.id, question_text: question.data.text, question_type: question.data.type,
    question_order: question.data.order, choices: question.data.type === 'multiple_choice'
      ? question.choices.map(choice => ({ choice_id: choice.id, choice_text: choice.data.text })) : [] }))
}
async function ssNewQuestion(ctx, surveyId, text, type, order, choices) {
  if (charLength(text) > 255) ssError('Invalid request.')
  const id = randomId(), path = `surveys/${surveyId}/questions/${id}`
  const writes = [ssWrite(ctx, path, { text, type, order, legacyId: null })]
  if (type === 'multiple_choice') for (const [index, choice] of choices.filter(value => value !== '').entries()) {
    if (charLength(choice) > 150) ssError('Invalid request.')
    writes.push(ssWrite(ctx, `${path}/choices/${randomId()}`, { text: choice, order: index, legacyId: null }))
  }
  return [id, writes]
}
async function ssMutateQuestion(ctx, surveyId, tx, action, input) {
  const questions = await ssQuestions(ctx, surveyId, tx)
  const questionId = action === 'questionCreate' ? '' : ssId(input[action === 'questionMove' ? 'qid' : 'question_id'] ?? '0')
  const owned = questions.find(question => question.id === questionId) ?? null
  const path = `surveys/${surveyId}/questions/${questionId}`
  const writes = []
  let message

  if (action === 'questionCreate' || action === 'questionUpdate') {
    if (action === 'questionUpdate' && !owned) ssError('That question does not belong to this survey.')
    const text = phpTrim(ssText(input, 'question_text')), type = ssType(input, 'question_type')
    const existingValue = action === 'questionUpdate' ? input.existing_choices ?? [] : {}
    if (action === 'questionUpdate' && !isRecord(existingValue) && !(Array.isArray(existingValue) && existingValue.length === 0)) ssError('Invalid request field: existing_choices.')
    const rawExisting = isRecord(existingValue) ? existingValue : {}
    const rawExistingEntries = Object.entries(rawExisting)
    if (rawExistingEntries.some(([, value]) => typeof value !== 'string')) ssError('Invalid request field: existing_choices.')
    const existing = Object.fromEntries(rawExistingEntries.map(([key, value]) => [key, phpTrim(value)]))
    const newChoices = ssChoices(input, action === 'questionUpdate' ? 'new_choices' : 'choices')
    const existingEntries = Object.entries(existing)
    const ownedIds = new Set((owned?.choices ?? []).map(choice => choice.id))
    for (const [key] of existingEntries) if (!ownedIds.has(key)) ssError('Invalid request field: existing_choices.')
    if (!text) ssError('Question text is required.')
    if (!validWrittenText(text, 5)) ssError('Write the question out in words: at least five characters, and not one repeated character.')
    if (type === 'multiple_choice' && [...existingEntries.map(([, value]) => value), ...newChoices].filter(value => value !== '').length < 2)
      ssError('A multiple-choice question needs at least two choices. Blank boxes are ignored.')
    if (charLength(text) > 255) ssError('Invalid request.')

    if (action === 'questionCreate') {
      const order = questions.length ? Math.max(...questions.map(question => question.data.order)) + 1 : 1
      const created = await ssNewQuestion(ctx, surveyId, text, type, order, newChoices)
      writes.push(...created[1]); message = 'Question added.'
    } else {
      writes.push(ssWrite(ctx, path, { text, type }, true))
      for (const choice of owned.choices) {
        if (type !== 'multiple_choice' || (Object.hasOwn(existing, choice.id) && existing[choice.id] === '')) writes.push(ssDelete(ctx, `${path}/choices/${choice.id}`))
        else if (Object.hasOwn(existing, choice.id)) {
          if (charLength(existing[choice.id]) > 150) ssError('Invalid request.')
          writes.push(ssWrite(ctx, `${path}/choices/${choice.id}`, { text: existing[choice.id] }, true))
        }
      }
      let order = owned.choices.length ? Math.max(...owned.choices.map(choice => choice.data.order)) + 1 : 0
      if (type === 'multiple_choice') for (const choice of newChoices) if (choice !== '') {
        if (charLength(choice) > 150) ssError('Invalid request.')
        writes.push(ssWrite(ctx, `${path}/choices/${randomId()}`, { text: choice, order: order++, legacyId: null }))
      }
      message = 'Question updated.'
    }
  } else if (action === 'questionDelete') {
    if (owned) {
      for (const choice of owned.choices) writes.push(ssDelete(ctx, `${path}/choices/${choice.id}`))
      writes.push(ssDelete(ctx, path))
    }
    let order = 1
    for (const question of questions) if (question.id !== questionId) writes.push(ssWrite(ctx, `surveys/${surveyId}/questions/${question.id}`, { order: order++ }, true))
    message = 'Question deleted.'
  } else {
    const direction = ssText(input, 'move') === 'up' ? 'up' : 'down'
    if (owned) {
      const candidates = questions.filter(question => direction === 'up' ? question.data.order < owned.data.order : question.data.order > owned.data.order)
      const other = direction === 'up' ? candidates.at(-1) : candidates[0]
      if (other) {
        writes.push(ssWrite(ctx, path, { order: other.data.order }, true))
        writes.push(ssWrite(ctx, `surveys/${surveyId}/questions/${other.id}`, { order: owned.data.order }, true))
      }
    }
    message = 'Question order updated.'
  }

  writes.push(ssWrite(ctx, `surveys/${surveyId}`, {}, true, ['updatedAt']))
  return [writes, { question_id: action === 'questionCreate' ? writes[0]?.update?.name.split('/').at(-1) ?? '' : questionId, message }]
}
async function ssTransaction(ctx, work) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const tx = await ctx.store.begin()
    try {
      await ctx.actorInTransaction(tx, { roles: ['staff', 'admin'] })
      const [writes, result] = await work(tx)
      if (writes.length > 500) ssError('The request could not be completed. Please try again.', 422)
      if (!writes.length) { await ctx.store.rollback(tx); return result }
      const committed = await ctx.store.commit(writes, tx)
      if (committed.status === 409 || committed.body?.error?.status === 'ABORTED') {
        await ctx.store.rollback(tx)
        continue
      }
      if (committed.status !== 200) throw new HttpError('The system is temporarily unavailable. Please try again in a few minutes.', 503)
      return result
    } catch (error) {
      await ctx.store.rollback(tx).catch(() => {})
      if (error?.retry && attempt < 4) continue
      throw error
    }
  }
  throw new HttpError('Survey changed; retry', 503)
}
async function ssDeleteBatch(ctx, surveyId, writes) {
  if (!writes.length) return
  await ssTransaction(ctx, async tx => {
    const survey = await ssSurvey(ctx, surveyId, tx, true)
    if (!survey || survey.status !== 'inactive' || !await ssRead(ctx, `surveys/${surveyId}/management/deletion`, tx)) ssError('The request could not be completed. Please try again.', 409)
    return [writes, []]
  })
}
async function ssClearCollection(ctx, surveyId, parent, collection) {
  while (true) {
    const rows = await ssQuery(ctx, parent, collection, null, [], 400)
    if (!rows.length) return
    await ssDeleteBatch(ctx, surveyId, rows.map(row => ssDelete(ctx, `${parent}/${collection}/${row.id}`)))
  }
}
async function ssDeleteSurvey(ctx, surveyId) {
  const survey = await ssTransaction(ctx, async tx => {
    const current = await ssSurvey(ctx, surveyId, tx, true)
    if (!current) ssError('The selected survey could not be found or deleted.')
    const marker = await ssRead(ctx, `surveys/${surveyId}/management/deletion`, tx)
    if (marker) return [[], current]
    return [[ssWrite(ctx, `surveys/${surveyId}`, { status: 'inactive' }, true, ['updatedAt']),
      ssWrite(ctx, `surveys/${surveyId}/management/deletion`, { title: current.title }, false, ['startedAt'])], current]
  })

  while (true) {
    const responses = await ssQuery(ctx, '', 'responses', null, ['surveyId', surveyId], 400)
    if (!responses.length) break
    for (const response of responses) await ssClearCollection(ctx, surveyId, `responses/${response.id}`, 'answers')
    await ssDeleteBatch(ctx, surveyId, responses.map(response => ssDelete(ctx, `responses/${response.id}`)))
  }
  while (true) {
    const questions = await ssQuery(ctx, `surveys/${surveyId}`, 'questions', null, [], 400)
    if (!questions.length) break
    for (const question of questions) await ssClearCollection(ctx, surveyId, `surveys/${surveyId}/questions/${question.id}`, 'choices')
    await ssDeleteBatch(ctx, surveyId, questions.map(question => ssDelete(ctx, `surveys/${surveyId}/questions/${question.id}`)))
  }
  await ssClearCollection(ctx, surveyId, `surveys/${surveyId}`, 'validation')
  await ssDeleteBatch(ctx, surveyId, [ssDelete(ctx, `surveys/${surveyId}/management/deletion`), ssDelete(ctx, `surveys/${surveyId}`)])
  return { ok: true, data: null, message: `Survey “${survey.title}” was deleted successfully.`, redirect: '/staff/survey-management' }
}
function ssTomorrowPlusSeven() {
  const start = today(), [year, month, day] = start.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10)
}

export async function handleStaffSurveys(ctx, action, input) {
  if (ctx.request.method !== 'POST') fail('Method not allowed.', 405)
  if (ctx.bodySize > 1048576) fail('Invalid request.', 413)
  if (typeof input.idToken !== 'string' || typeof input.action !== 'string') fail('Invalid request.', 400)
  const { identity } = await ctx.actor({ roles: ['staff', 'admin'] })
  const actorUid = ssId(identity.localId)
  if (!allowedActions.has(action)) fail('Not found.', 404)

  if (action === 'list') {
    const surveys = await ssQuery(ctx, '', 'surveys')
    surveys.sort((a, b) => (new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()) || compareText(a.id, b.id))
    const responseRows = await ssQuery(ctx, '', 'responses', null, [], 0, ['surveyId'])
    const counts = new Map()
    for (const row of responseRows) counts.set(row.data.surveyId, (counts.get(row.data.surveyId) ?? 0) + 1)
    return { ok: true, data: { surveys: surveys.map(row => ({ ...ssSurveyRow(row.id, row.data), response_count: counts.get(row.id) ?? 0 })),
      defaults: { start_date: today(), end_date: ssTomorrowPlusSeven() } } }
  }

  const surveyId = action === 'create' ? randomId() : ssId(input[action.startsWith('question') ? 'survey_id' : 'id'] ?? '0')
  if (action === 'delete') return ssDeleteSurvey(ctx, surveyId)

  const result = await ssTransaction(ctx, async tx => {
    const survey = action === 'create' ? null : await ssSurvey(ctx, surveyId, tx)
    if (!survey && action !== 'create') return [[], { ok: true, data: null, redirect: '/staff/survey-management' }]
    if (action === 'get' || action === 'questions') return [[], { ok: true, data: { survey: ssSurveyRow(surveyId, survey),
      ...(action === 'questions' ? { questions: ssQuestionRows(await ssQuestions(ctx, surveyId, tx)) } : {}) } }]
    if (action.startsWith('question')) {
      const [writes, changed] = await ssMutateQuestion(ctx, surveyId, tx, action, input)
      return [writes, { ok: true, data: { question_id: changed.question_id }, message: changed.message }]
    }
    if (action === 'toggle') return [[ssWrite(ctx, `surveys/${surveyId}`, { status: survey.status === 'active' ? 'inactive' : 'active' }, true, ['updatedAt'])],
      { ok: true, data: null, redirect: '/staff/survey-management' }]
    const metadata = ssMetadata(input)
    if (action === 'update') {
      const status = ssText(input, 'status', 'active')
      if (!['active', 'inactive'].includes(status)) ssError('Invalid request field: status.')
      const next = { ...survey, ...metadata, status }
      return [[ssWrite(ctx, `surveys/${surveyId}`, { ...metadata, status }, true, ['updatedAt'])],
        { ok: true, data: { survey: ssSurveyRow(surveyId, next) }, message: 'Survey updated successfully.' }]
    }
    const writes = [ssWrite(ctx, `surveys/${surveyId}`, { ...metadata, status: 'active', createdByUid: actorUid, legacyId: null }, false, ['createdAt', 'updatedAt'])]
    let order = 0
    for (const question of ssArray(input, 'questions')) {
      if (!isRecord(question)) ssError('Invalid request field: questions.')
      const text = phpTrim(ssText(question, 'text'))
      if (!text) continue
      const [, questionWrites] = await ssNewQuestion(ctx, surveyId, text, ssType(question, 'type'), ++order, ssChoices(question, 'choices'))
      writes.push(...questionWrites)
    }
    if (!order) ssError('Please add at least one question, and give it a question to ask.')
    return [writes, { ok: true, data: { survey_id: surveyId }, redirect: '/staff/survey-management' }]
  })
  if (action.startsWith('question') && action !== 'questions' && !result.redirect) {
    result.data.questions = ssQuestionRows(await ssQuestions(ctx, surveyId))
  }
  return result
}
