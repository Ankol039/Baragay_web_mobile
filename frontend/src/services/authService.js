import { EmailAuthProvider, onIdTokenChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { ApiError } from '../api/client.js'
import detectAccountType from '../utils/detectAccountType.js'
import { authDestination } from '../routes/authRedirect.js'
import { getFirebase } from './firebase.js'
import { assertAccount, invalidLogin, loadUserProfile } from './authProfile.js'
import { authBridge as bridge } from './authBridge.js'

let rules
let invalidation
let credentialMutation
function invalidateSession() {
  if (!invalidation) invalidation = logout().catch(() => signOut(getFirebase().auth))
    .finally(() => { invalidation = null })
  return invalidation
}
async function passwordRules() {
  if (!rules) rules = (await bridge('rules')).data
  return rules
}
function friendly(error, current = false) {
  if (!error.code) return error
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/user-disabled'].includes(error.code)) {
    return new ApiError(current ? 'Current password is incorrect.' : invalidLogin, current ? 422 : 401)
  }
  return new ApiError('Unable to connect. Please try again.')
}
export async function getSession() {
  if (credentialMutation) await credentialMutation
  const { auth } = getFirebase()
  await auth.authStateReady()
  const password_rules = await passwordRules()
  if (!auth.currentUser) return { authenticated: false, user: null, password_rules }
  try {
    const user = await loadUserProfile(auth.currentUser.uid)
    return { authenticated: true, user, password_rules }
  } catch (error) {
    if ([401, 403].includes(error.status)) await invalidateSession()
    throw error
  }
}
export async function login({ identifier, password }) {
  const { auth } = getFirebase()
  const normal = detectAccountType(identifier)
  if (!normal.identifier || !password) throw new ApiError('Please enter your username or Resident Number and password.', 422)
  try {
    const resolved = await bridge('resolve', { identifier: normal.identifier, password })
    const credential = await signInWithEmailAndPassword(auth, resolved.data.email, password)
    const data = await getSession()
    await bridge('login', { idToken: await credential.user.getIdToken(), operationId: crypto.randomUUID() })
    return { ok: true, data, redirect: authDestination(data.user) }
  } catch (error) {
    await signOut(auth)
    throw friendly(error)
  }
}
export async function logout() {
  const { auth } = getFirebase()
  if (auth.currentUser) {
    try {
      await bridge('logout', { idToken: await auth.currentUser.getIdToken(), operationId: crypto.randomUUID() })
    } catch (error) {
      // Expired/disabled identities must still be able to leave the app.
      if (![401, 403].includes(error.status)) throw error
    }
  }
  await signOut(auth)
  return { ok: true, data: { authenticated: false, user: null, password_rules: await passwordRules() }, redirect: '/landing' }
}
export async function changePassword(passwords) {
  const { auth } = getFirebase()
  if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
  if (credentialMutation) throw new ApiError('The request could not be completed. Please try again.', 409)
  let release
  credentialMutation = new Promise(resolve => { release = resolve })
  let result
  try {
    try {
      await reauthenticateWithCredential(auth.currentUser,
        EmailAuthProvider.credential(auth.currentUser.email, passwords.current_password))
    } catch (error) { throw friendly(error, true) }
    // Keep snapshot-triggered session reads behind SDK reauthentication. The
    // Firestore flag can arrive before the replacement Auth token is ready.
    result = await bridge('password', { ...passwords, idToken: await auth.currentUser.getIdToken() })
    await reauthenticateWithCredential(auth.currentUser,
      EmailAuthProvider.credential(auth.currentUser.email, passwords.new_password))
  } finally {
    credentialMutation = null
    release()
  }
  return { ...result, data: await getSession() }
}
export function observeSession(onChange, onError) {
  const { auth, db } = getFirebase()
  let stopProfile = () => {}
  function recheckAfterCredentials() {
    void credentialMutation.then(() => getSession()).then(() => onChange()).catch(error => {
      if (![401, 403].includes(error.status)) onError(error)
    })
  }
  const stopAuth = onIdTokenChanged(auth, user => {
    stopProfile()
    if (!user) { onChange(); return }
    stopProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
      if (credentialMutation) { recheckAfterCredentials(); return }
      try { assertAccount(snapshot.exists() ? snapshot.data() : null) }
      catch { void invalidateSession(); return }
      onChange()
    }, error => {
      if (credentialMutation) { recheckAfterCredentials(); return }
      if (['permission-denied', 'unauthenticated'].includes(error.code)) void invalidateSession()
      else onError(error)
    })
  }, onError)
  return () => { stopProfile(); stopAuth() }
}
