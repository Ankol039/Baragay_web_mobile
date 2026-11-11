import { ApiError } from '../api/client.js'
import { getFirebase } from './firebase.js'
import { firebaseEndpoint } from '../api/firebaseBackend.js'

// The JavaScript Worker preserves original validation and performs trusted Firestore cascades.
// Components never access Firestore or the legacy MySQL/session API directly.
async function request(action, values = {}) {
  const { auth } = getFirebase()
  await auth.authStateReady()
  if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
  const endpoint = firebaseEndpoint('staff-surveys.php')
  let response, result
  try {
    response = await fetch(endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, action, idToken: await auth.currentUser.getIdToken() }) })
  } catch { throw new ApiError('Unable to connect. Please try again.') }
  try { result = await response.json() }
  catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status) }
  if (!response.ok || !result.ok) throw new ApiError(result.message || 'The request could not be completed. Please try again.', response.status)
  return result
}
export const listSurveys = () => request('list')
export const getSurvey = id => request('get', { id })
export const createSurvey = values => request('create', values)
export const updateSurvey = values => request('update', values)
export const toggleSurvey = id => request('toggle', { id })
export const deleteSurvey = id => request('delete', { id })
export const getQuestions = survey_id => request('questions', { survey_id })
export const createQuestion = values => request('questionCreate', values)
export const updateQuestion = values => request('questionUpdate', values)
export const deleteQuestion = values => request('questionDelete', values)
export const moveQuestion = values => request('questionMove', values)
