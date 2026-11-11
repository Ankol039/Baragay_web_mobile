import { collection, doc, getDocFromServer, getDocsFromServer, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { ApiError } from './errors.js'
import { dashboardData } from './resident/dashboard.js'
import { asDate, dateKey, dateLabel, eventValue, todayKey } from './resident/format.js'
import { trimWidth } from './resident/trimWidth.js'
import { csvText } from './resident/csv.js'
import { residentSession as session, residentBridge as bridge } from './resident/context.js'

const result = data => ({ ok: true, data })
const destination = () => ({ ...result(null), redirect: '/resident/history' })
const rows = snapshot => snapshot.docs.map(row => ({ ...row.data(), id: row.id }))
const idPattern = /^[A-Za-z0-9_-]{1,300}$/

async function ownResponses({ db, identity }) {
  return rows(await getDocsFromServer(query(collection(db, 'responses'), where('residentUid', '==', identity.uid), orderBy('submittedAt', 'desc'))))
}
async function openSurveys({ db }) {
  const day = todayKey()
  try {
    return rows(await getDocsFromServer(query(collection(db, 'surveys'), where('status', '==', 'active'),
      where('endDate', '>=', Timestamp.fromDate(new Date(day))), where('startDate', '<=', Timestamp.fromDate(new Date(day))),
      orderBy('endDate'), orderBy('startDate'))))
  } catch (error) {
    if (todayKey() !== day) return openSurveys({ db })
    throw error
  }
}
function surveyRow(survey) {
  return { survey_id: survey.id, title: survey.title, description: survey.description,
    description_short: trimWidth(survey.description || '', 80), end_date: dateKey(survey.endDate), end_date_label: dateLabel(survey.endDate) }
}
async function historyRows(context, responses) {
  const { surveys } = await bridge(context, 'history')
  return responses.filter(row => surveys[row.surveyId]).map(row => ({
    response_id: row.legacyId ?? row.id, survey_id: row.surveyId, submitted_at: eventValue(row.submittedAt), instant: row.submittedAt,
    title: surveys[row.surveyId].title, description: surveys[row.surveyId].description,
    description_short: surveys[row.surveyId].description_short,
    submitted_at_label: dateLabel(row.submittedAt, { event: true, padded: true, time: true }),
  }))
}
export async function getResidentDashboard() {
  const context = await session(), { db, identity, account } = context
  const [profile, children, references, surveys, responses] = await Promise.all([
    getDocFromServer(doc(db, 'residents', identity.uid)),
    getDocsFromServer(collection(db, 'residents', identity.uid, 'children')),
    getDocsFromServer(collection(db, 'residents', identity.uid, 'characterReferences')),
    openSurveys(context), ownResponses(context),
  ])
  return result(dashboardData(account, profile.data(), children.docs, references.docs, surveys, responses,
    await historyRows(context, responses), new Date()))
}
export async function getResidentSurveys(submittedId = null) {
  const context = await session()
  const [surveys, responses, submitted] = await Promise.all([openSurveys(context), ownResponses(context),
    submittedId && idPattern.test(submittedId) ? bridge(context, 'submitted', { surveyId: submittedId }) : null])
  const answeredIds = new Set(responses.map(row => row.surveyId)), open = [], answered = []
  surveys.sort((a, b) => asDate(b.startDate) - asDate(a.startDate))
  for (const survey of surveys) {
    const done = answeredIds.has(survey.id)
    ;(done ? answered : open).push({ ...surveyRow(survey), already_answered: Number(done) })
  }
  return result({ open, answered, submitted })
}
export async function getResidentStatDetail(view) {
  if (!['available', 'completed', 'assigned'].includes(view)) return { ...result(null), redirect: '/resident/dashboard' }
  const context = await session(), responses = await ownResponses(context)
  let data
  if (view === 'completed') {
    data = (await historyRows(context, responses)).map(row => ({ title: row.title, submitted_at: row.submitted_at,
      submitted_at_label: dateLabel(row.instant, { event: true, time: true }) }))
  } else {
    const done = new Set(responses.map(row => row.surveyId))
    data = (await openSurveys(context)).filter(row => view === 'assigned' || !done.has(row.id)).map(row => ({
      survey_id: row.id, title: row.title, end_date: dateKey(row.endDate), end_date_label: dateLabel(row.endDate),
      ...(view === 'assigned' ? { answered: Number(done.has(row.id)) } : { description: row.description }),
    })).sort((a, b) => (a.answered || 0) - (b.answered || 0) || a.end_date.localeCompare(b.end_date))
  }
  return result({ view, count: data.length, rows: data })
}
export async function getResidentHistory() {
  const context = await session()
  const history = await historyRows(context, await ownResponses(context))
  return result({ responses: history.map(({ instant, ...row }) => { void instant; return row }) })
}
export async function getResidentResponse(id) {
  const context = await session()
  if (!idPattern.test(id)) return destination()
  // Query by owner even for direct links. Numeric legacy response URLs still work.
  const own = await ownResponses(context)
  const response = own.find(row => row.id === id || (row.legacyId != null && String(row.legacyId) === id))
  if (!response) return destination()
  const metadata = await bridge(context, 'response', { responseId: response.id })
  if (!metadata) return destination()
  const answers = rows(await getDocsFromServer(collection(context.db, 'responses', response.id, 'answers')))
  metadata.questions.sort((a, b) => a.order - b.order || (a.legacyId ?? 0) - (b.legacyId ?? 0) || a.id.localeCompare(b.id))
  return result({ response: { response_id: response.legacyId ?? response.id, title: metadata.survey.title, description: metadata.survey.description,
    submitted_at: eventValue(response.submittedAt), submitted_at_label: dateLabel(response.submittedAt, { event: true, full: true, padded: true, time: true }) },
  answers: metadata.questions.map(question => {
    const answer = answers.find(row => row.questionId === question.id)
    const choice = question.choices.find(row => row.id === answer?.choiceId)
    const text = question.type === 'multiple_choice' ? choice?.text ?? 'No answer'
      : question.type === 'rating' ? answer?.rating != null ? `${answer.rating} / 5` : 'No answer' : answer?.text || 'No answer'
    return { question_id: question.id, question_text: question.text, question_type: question.type, question_order: question.order,
      choice_id: answer?.choiceId ?? null, choice_text: choice?.text ?? null, rating_value: answer?.rating ?? null,
      answer_text: answer && !['multiple_choice', 'rating'].includes(question.type) ? answer.text : null, display_answer: text }
  }) })
}
export async function getResidentResponseCsv(id) {
  const payload = await getResidentResponse(id)
  if (!payload.data) throw new ApiError('Response not found.', 404)
  const { response, answers } = payload.data
  const csv = csvText([['Survey', response.title], ['Submitted', response.submitted_at], [], ['Question', 'Answer'],
    ...answers.map(row => [row.question_text, row.question_type === 'multiple_choice' ? row.choice_text ?? ''
      : row.question_type === 'rating' ? row.rating_value != null ? `${row.rating_value} / 5` : '' : row.answer_text ?? ''])])
  return { filename: `survey-response-${response.response_id}.csv`, csv }
}
