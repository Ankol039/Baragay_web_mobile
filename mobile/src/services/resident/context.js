import { doc, getDocFromServer } from 'firebase/firestore'
import { ApiError } from '../errors.js'
import { getFirebase } from '../firebase'
import { assertAccount } from '../authProfile.js'

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
  void context
  const { request } = await import('../transport.js')
  return (await request(`${schema ? 'survey-schema' : 'resident-read'}.php`, { ...body, action })).data
}
