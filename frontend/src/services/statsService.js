import { ApiError } from '../api/client.js'
import { getFirebase } from './firebase.js'
import { firebaseEndpoint } from '../api/firebaseBackend.js'

async function request(action, values = {}, { signal } = {}) {
  const { auth } = getFirebase()
  await auth.authStateReady()
  if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
  const endpoint = firebaseEndpoint('staff-reports.php')
  let response, result
  try {
    response = await fetch(endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store', signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, action, idToken: await auth.currentUser.getIdToken() }) })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('Unable to connect. Please try again.')
  }
  try { result = await response.json() }
  catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status) }
  if (!response.ok || !result.ok) throw new ApiError(result.message || 'The request could not be completed. Please try again.', response.status)
  return result
}
export const getDashboard = options => request('dashboard', {}, options)
export const getTrend = (from, to, options) => request('trend', { from, to }, options)
export const getStatDetail = (view, options) => request('detail', { view }, options)
export const getResults = (survey_id, report, options) => request(report ? 'report' : 'results', { survey_id }, options)
export async function exportReport(survey_id) {
  const result = await request('csv', { survey_id })
  if (result.redirect) return result
  const url = URL.createObjectURL(new Blob([result.data.csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url; link.download = result.data.filename
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return result
}
