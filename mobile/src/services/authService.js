import { EmailAuthProvider, onIdTokenChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { ApiError } from './errors.js'
import * as Crypto from 'expo-crypto'
const detectAccountType = value => ({ identifier: String(value || '').trim() })
const authDestination = () => '/'
import { getFirebase } from './firebase'
import { assertAccount, invalidLogin, loadUserProfile } from './authProfile.js'
import { authBridge as bridge } from './authBridge.js'

let rules
let invalidation
let passwordUpdate
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
export async function getSession(duringPassword = false) {
  if (passwordUpdate && !duringPassword) await passwordUpdate
  const { auth } = getFirebase()
  await auth.authStateReady()
  const password_rules = await passwordRules()
  if (!auth.currentUser) return { authenticated: false, user: null, password_rules }
  try {
    const user = await loadUserProfile(auth.currentUser.uid)
    return { authenticated: true, user, password_rules }
  } catch (error) {
    if (passwordUpdate && !duringPassword) { await passwordUpdate; return getSession() }
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
    await bridge('login', { idToken: await credential.user.getIdToken(), operationId: Crypto.randomUUID() })
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
      await bridge('logout', { idToken: await auth.currentUser.getIdToken(), operationId: Crypto.randomUUID() })
    } catch (error) {
      // Expired/disabled identities must still be able to leave the app.
      if (![401, 403].includes(error.status)) console.warn('Logout audit unavailable.')
    }
  }
  await signOut(auth)
  return { ok: true, data: { authenticated: false, user: null, password_rules: await passwordRules() }, redirect: '/landing' }
}
export async function changePassword(passwords) {
  if (passwordUpdate) throw new ApiError('Please wait for your password change to finish.')
  let finish
  passwordUpdate = new Promise(resolve => { finish = resolve })
  try {
    const { auth } = getFirebase()
    if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
    try {
      await reauthenticateWithCredential(auth.currentUser,
        EmailAuthProvider.credential(auth.currentUser.email, passwords.current_password))
    } catch (error) { throw friendly(error, true) }
    // Trusted server enforces the existing PHP policy, changes the Auth password,
    // then clears isFirstLogin. Clients cannot clear that flag through rules.
    const result = await bridge('password', { ...passwords, idToken: await auth.currentUser.getIdToken() })
    await reauthenticateWithCredential(auth.currentUser,
      EmailAuthProvider.credential(auth.currentUser.email, passwords.new_password))
    return { ...result, data: await getSession(true) }
  } finally { const release = finish; passwordUpdate = null; release() }
}
export function observeSession(onChange, onError) {
  const { auth, db } = getFirebase()
  let stopProfile = () => {}
  const stopAuth = onIdTokenChanged(auth, user => {
    stopProfile()
    if (!user) { onChange(); return }
    stopProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
      try { assertAccount(snapshot.exists() ? snapshot.data() : null) }
      catch { void invalidateSession(); return }
      onChange()
    }, error => {
      if (passwordUpdate) void passwordUpdate.then(onChange)
      else if (['permission-denied', 'unauthenticated'].includes(error.code)) void invalidateSession()
      else onError(error)
    })
  }, onError)
  return () => { stopProfile(); stopAuth() }
}
