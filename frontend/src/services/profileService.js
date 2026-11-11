import { ApiError } from '../api/client.js'
import { getFirebase } from './firebase.js'
import { compressProfilePhoto } from './resident/profilePhoto.js'
import { firebaseEndpoint } from '../api/firebaseBackend.js'

// Keep the original PHP-defined policy on the trusted JavaScript Firestore
// boundary shared by every caller. No legacy session API, MySQL bootstrap or
// Storage is involved.
async function request(action, values = {}) {
  const { auth } = getFirebase()
  await auth.authStateReady()
  if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
  const endpoint = firebaseEndpoint('resident-profile.php')
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
export const getProfile = () => request('get')
export const saveContact = values => request('contact', values)
export const requestBirthdate = values => request('birthdate', values)
export const requestNameAddress = values => request('nameAddress', values)
export const requestFamily = values => request('family', values)
export const removePhoto = () => request('removePhoto')
export const uploadPhoto = async file => request('photo', { photo: await compressProfilePhoto(file) })
