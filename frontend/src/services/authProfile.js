import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore'
import { ApiError } from '../api/client.js'
import { getFirebase } from './firebase.js'
import { authBridge } from './authBridge.js'

export const invalidLogin = 'Invalid username/Resident Number or password.'
export function assertAccount(account) {
  if (!account || !['resident', 'staff', 'admin'].includes(account.role) || account.deletedAt != null) {
    throw new ApiError(invalidLogin, 401)
  }
  if (!account.isActive) throw new ApiError(account.role === 'resident'
    ? 'This account has been deactivated. Please contact the Barangay Health Center.'
    : 'This account has been deactivated. Please contact the administrator.', 403)
}

// Preserve the PHP session's public shape so every existing useAuth consumer works.
export async function loadUserProfile(uid) {
  const { auth, db } = getFirebase()
  const snapshot = await getDoc(doc(db, 'users', uid))
  const account = snapshot.exists() ? snapshot.data() : null
  assertAccount(account)
  if (account.uid !== uid) throw new ApiError(invalidLogin, 401)
  const staff = account.role !== 'resident'
  // A first-login resident cannot read the full resident profile under rules.
// The trusted JavaScript API exposes only the same header fields as the old API.
  const { data: header } = await authBridge('profile', { idToken: await auth.currentUser.getIdToken() })
  const image = (await getDoc(doc(db, 'profileImages', uid))).data()
  const profilePhoto = header.photo_data_url ?? undefined
  const photo = profilePhoto !== undefined ? profilePhoto || null : image ? `data:${image.mimeType};base64,${image.base64}` : null
  const ready = !account.isFirstLogin && account.profileCompleted
  const user = {
    uid, id: account.legacyId ?? uid, role: account.role, account_type: staff ? 'staff' : 'resident',
    ...header,
    photo, photo_path: photo || '', has_photo: Boolean(photo),
    is_first_login: account.isFirstLogin, profile_completed: staff ? account.profileCompleted : true,
    is_active: account.isActive, deleted_at: null, show_sidebar: ready,
    portal_label: staff ? (account.role === 'admin' ? 'Admin Portal' : 'Staff Portal') : 'Resident Portal',
    ...(staff ? { staff_number: account.identifier, username: account.username } : { resident_number: account.identifier }),
  }
  if (account.role === 'admin' && ready) {
    const [pending, archived] = await Promise.all([
      getCountFromServer(query(collection(db, 'deletionRequests'), where('status', '==', 'pending'))),
      getCountFromServer(query(collection(db, 'users'), where('deletedAt', '!=', null))),
    ])
    user.pending_deletions = pending.data().count
    user.archived_accounts = archived.data().count
  }
  return user
}
