import { ApiError } from '../api/client.js'
import { firebaseEndpoint } from '../api/firebaseBackend.js'

export async function authBridge(action, body) {
  const endpoint = firebaseEndpoint('index.php')
  let response
  try {
    response = await fetch(`${endpoint}?action=${action}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch { throw new ApiError('Unable to connect. Please try again.') }
  let result
  try { result = await response.json() }
  catch { throw new ApiError('The server returned an unexpected response. Please try again.', response.status) }
  if (!response.ok || !result?.ok) throw new ApiError(result?.message || 'The request could not be completed. Please try again.', response.status)
  return result
}
