import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import { ApiError } from '../api/client.js'
import { validateResponse, responseMessages } from '../shared/validateResponse.js'
import { residentSession, residentBridge } from './resident/context.js'
import { todayKey, dateKey } from './resident/format.js'
export { getResidentResponseCsv as getResponseCsv } from './residentService.js'

const result = data => ({ ok: true, data })
const destination = () => ({ ...result(null), redirect: '/resident/surveys' })
const validId = id => typeof id === 'string' && /^[A-Za-z0-9-]{1,128}$/.test(id)
const rows = snapshot => snapshot.docs.map(row => ({ ...row.data(), id: row.id }))
const isOpen = survey => survey?.status === 'active' && dateKey(survey.startDate) <= todayKey() && dateKey(survey.endDate) >= todayKey()
const formPath = id => `/resident/survey-form?id=${encodeURIComponent(id)}`
const permissionDenied = error => error.code === 'permission-denied'

async function load(context, id) {
  if (!validId(id)) return null
  const { db, identity } = context
  const response = await getDocFromServer(doc(db, 'responses', `${id}_${identity.uid}`))
  if (response.exists()) return null
  let survey
  try { survey = (await getDocFromServer(doc(db, 'surveys', id))).data() }
  catch (error) { if (permissionDenied(error)) return null; throw error }
  if (!isOpen(survey)) return null
  const questions = rows(await getDocsFromServer(collection(db, 'surveys', id, 'questions')))
  questions.sort((a, b) => a.order - b.order || (a.legacyId ?? 0) - (b.legacyId ?? 0) || a.id.localeCompare(b.id))
  await Promise.all(questions.map(async question => {
    question.choices = question.type === 'multiple_choice'
      ? rows(await getDocsFromServer(collection(db, 'surveys', id, 'questions', question.id, 'choices')))
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)) : []
  }))
  return { survey: { ...survey, id }, questions }
}
export async function getSurvey(id) {
  const context = await residentSession()
  try {
    const data = await load(context, id)
    if (!data) return destination()
    return result({ survey: { survey_id: id, title: data.survey.title, description: data.survey.description },
      questions: data.questions.map(q => ({ ...q, question_id: q.id, question_text: q.text, question_type: q.type,
        question_order: q.order, choices: q.choices.map(c => ({ ...c, choice_id: c.id, choice_text: c.text })) })) })
  } catch (error) { if (permissionDenied(error)) return destination(); throw error }
}
export async function submitResponse(id, input) {
  const context = await residentSession(), { db, identity } = context
  if (!validId(id)) return destination()
  try {
    const data = await load(context, id)
    if (!data) return destination()
    // This bridge writes only trusted required-question metadata, never a response.
    if (!await residentBridge(context, 'prepare', { surveyId: id }, true)) return destination()
    return await runTransaction(db, async transaction => {
      const parentRef = doc(db, 'responses', `${id}_${identity.uid}`)
      const [surveyDoc, existing, schema] = await Promise.all([
        transaction.get(doc(db, 'surveys', id)), transaction.get(parentRef),
        transaction.get(doc(db, 'surveys', id, 'validation', 'response')),
      ])
      const survey = surveyDoc.data()
      if (existing.exists() || !isOpen(survey)) return destination()
      if (!schema.exists() || !schema.data().surveyVersion.isEqual(survey.updatedAt)
        || !survey.updatedAt.isEqual(data.survey.updatedAt)) throw new ApiError(responseMessages.failed)
      // Re-read definitions/selected choices inside the transaction: edits conflict/retry.
      const questions = await Promise.all(data.questions.map(async q => {
        const fresh = await transaction.get(doc(db, 'surveys', id, 'questions', q.id))
        if (!fresh.exists()) throw new ApiError(responseMessages.failed)
        const choices = await Promise.all(q.choices.map(async c => {
          const choice = await transaction.get(doc(db, 'surveys', id, 'questions', q.id, 'choices', c.id))
          return choice.exists() ? { ...choice.data(), id: c.id } : null
        }))
        return { ...fresh.data(), id: q.id, choices: choices.filter(Boolean) }
      }))
      const validation = validateResponse(questions, input)
      if (!validation.valid) {
        if (validation.code === 'empty') return { ...result(null), redirect: `${formPath(id)}&error=empty` }
        throw new ApiError(validation.message, 422)
      }
      transaction.set(parentRef, { surveyId: id, residentUid: identity.uid, surveyTitle: survey.title,
        firstAnswerId: validation.answers[0].questionId, submittedAt: serverTimestamp(), legacyId: null })
      for (const answer of validation.answers) transaction.set(doc(parentRef, 'answers', answer.questionId), { ...answer, submittedAt: serverTimestamp() })
      return { ...result(null), redirect: `/resident/surveys?submitted=${encodeURIComponent(id)}` }
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) throw error
    // Reclassify a closure or concurrent winner using fresh, owner-scoped reads.
    if (permissionDenied(error) || error.code === 'aborted') {
      try { if (!await load(context, id)) return destination() }
      catch { /* Preserve the original safe retry flow when revalidation is unavailable. */ }
    }
    return { ...result(null), redirect: `${formPath(id)}&error=failed` }
  }
}
export async function getSurveyConfirmation(id) {
  const context = await residentSession()
  const survey = validId(id) ? await residentBridge(context, 'submitted', { surveyId: id }) : null
  return result({ title: survey?.title ?? 'the survey' })
}
