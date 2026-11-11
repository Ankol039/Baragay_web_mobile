import { doc, getDocFromServer } from 'firebase/firestore'
import { ApiError } from './errors.js'
import { getFirebase } from './firebase'
import { authBridge } from './authBridge.js'
export const invalidLogin = 'Invalid username/Resident Number or password.'
export function assertAccount(account) {
  if (!account || account.deletedAt != null) throw new ApiError(invalidLogin, 401)
  if (!account.isActive) throw new ApiError('This account has been deactivated. Please contact the Barangay Health Center.', 403)
  if (account.role !== 'resident') throw new ApiError('Staff and administrator accounts must use the website. This app is for residents.', 403)
}
export async function loadUserProfile(uid) {
  const { auth, db } = getFirebase()
  const account = (await getDocFromServer(doc(db, 'users', uid))).data()
  assertAccount(account)
  if (account.uid !== uid) throw new ApiError(invalidLogin, 401)
  const { data } = await authBridge('profile', { idToken: await auth.currentUser.getIdToken() })
  return { ...data, uid, role: account.role, resident_number: account.identifier,
    is_first_login: account.isFirstLogin, profile_completed: account.profileCompleted }
}
