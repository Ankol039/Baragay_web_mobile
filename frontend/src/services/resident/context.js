import { doc, getDocFromServer } from 'firebase/firestore'
import { ApiError } from '../../api/client.js'
import { getFirebase } from '../firebase.js'
import { assertAccount } from '../authProfile.js'
import { firebaseEndpoint } from '../../api/firebaseBackend.js'

export async function residentSession() {
  const { auth, db } = getFirebase()
  await auth.authStateReady()
  const identity = auth.currentUser
  if (!identity) throw new ApiError('Please sign in to continue.', 401)
  const account = (await getDocFromServer(doc(db, 'users', identity.uid))).data()
  assertAccount(account)
  if (account.role !== 'resident' || account.isFirstLogin || !account.profileCompleted) throw new ApiError('Access denied.', 403)
  return { db, identity, account }
}
export async function residentBridge(context, action, body = {}, schema = false) {
  const endpoint = firebaseEndpoint(schema ? 'survey-schema.php' : 'resident-read.php')
  let response, payload
  try {
    response = await fetch(endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, action, idToken: await context.identity.getIdToken() }) })
  } catch { throw new ApiError('Unable to connect. Please try again.') }
  try { payload = await response.json() }
  catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status) }
  if (!response.ok || !payload.ok) throw new ApiError(payload.message || 'The request could not be completed. Please try again.', response.status)
  return payload.data
}
