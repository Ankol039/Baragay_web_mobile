import { ApiError } from './errors.js'
import { getFirebase } from './firebase'
export async function request(endpoint, values, authenticated = true) {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')
  if (!base) throw new ApiError('API configuration is missing. Please configure the mobile environment.')
  let body = values
  if (authenticated) {
    const { auth } = getFirebase(); await auth.authStateReady()
    if (!auth.currentUser) throw new ApiError('Please sign in to continue.', 401)
    body = { ...values, idToken: await auth.currentUser.getIdToken() }
  }
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 30000)
  try {
    const response = await fetch(`${base}/api/firebase/${endpoint}`, { method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: abort.signal })
    let payload
    try { payload = await response.json() } catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status) }
    if (!response.ok || !payload.ok) throw new ApiError(payload.message || 'The request could not be completed. Please try again.', response.status)
    return payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Unable to connect. Please try again.')
  } finally { clearTimeout(timer) }
}
