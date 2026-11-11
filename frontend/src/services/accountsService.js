import { ApiError } from '../api/client.js'
import { getFirebase } from './firebase.js'
import { compressProfilePhoto } from './resident/profilePhoto.js'
import { firebaseEndpoint } from '../api/firebaseBackend.js'

// All management reads/writes use the verified Firebase boundary. UUIDs survive
// a failed transport retry, while changed form values start a new operation.
const pending = new Map()
async function request(action, values = {}, mutate = false) {
  const { auth } = getFirebase()
  await auth.authStateReady()
  if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
  const binding = JSON.stringify([auth.currentUser.uid, action, values])
  const digest = mutate ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(binding))), byte => byte.toString(16).padStart(2, '0')).join('') : ''
  const key = `bss-account-operation-${digest}`
  if (mutate && !pending.has(binding)) {
    let saved
    try { saved = sessionStorage.getItem(key) } catch { /* memory fallback */ }
    pending.set(binding, saved || crypto.randomUUID())
    try { sessionStorage.setItem(key, pending.get(binding)) } catch { /* memory fallback */ }
  }
  function completed() { pending.delete(binding); if (mutate) { try { sessionStorage.removeItem(key) } catch { /* memory fallback */ } } }
  const endpoint = firebaseEndpoint('accounts.php')
  let response, result
  try {
    response = await fetch(endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, action, ...(mutate ? { operationId: pending.get(binding) } : {}), idToken: await auth.currentUser.getIdToken() }) })
  } catch { throw new ApiError('Unable to connect. Please try again.') }
  try { result = await response.json() }
  catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status) }
  if (!response.ok || !result.ok) {
    if (response.status < 500 && response.status !== 409) completed()
    throw new ApiError(result.message || 'The request could not be completed. Please try again.', response.status)
  }
  completed()
  return result
}
export const listResidents = () => request('residents')
export const listUsers = () => request('users')
export const getResident = id => request('resident', { id })
export const createResident = values => request('createResident', { values }, true)
export const updateResident = values => request('updateResident', { resident_id: String(values.resident_id), values }, true)
export const createStaff = values => request('createStaff', { values }, true)
export const getRequests = () => request('requests')
export const getDeletions = () => request('deletions')
export const getArchives = () => request('archives')
export const getResidencyRecords = filter => request('residencyRecords', { filter })
export const getStaffProfile = () => request('staffProfile')
export const saveStaffProfile = values => request('staffSave', values)
export const uploadStaffPhoto = async file => request('staffPhoto', { photo: await compressProfilePhoto(file) })
export const removeStaffPhoto = () => request('staffRemovePhoto')
export const reviewRequest = (kind, request_id, decision, review_comment) => request('review', { kind, request_id, decision, review_comment }, true)
export const archiveAction = (action, values) => request(action, values, true)
export function residentAction(action, resident_id, reason = '', source = '') {
  if (action === 'password-reset') return request('resetResident', { targetUid: String(resident_id) }, true)
  if (action === 'request-delete') return request('requestDeletion', { resident_id: String(resident_id), reason }, true)
  if (['promote', 'revert'].includes(action)) return request(action, { resident_id: String(resident_id), reason }, true)
  return request(action === 'delete' ? 'archive' : action, { targetUid: String(resident_id), kind: 'resident', source }, true)
}
export function userAction(action, id) {
  if (action === 'resident-toggle') return residentAction('toggle', id, '', 'users')
  return request(action === 'password-reset' ? 'resetStaff' : action === 'delete' ? 'archive' : action, { targetUid: String(id), kind: 'staff' }, true)
}
