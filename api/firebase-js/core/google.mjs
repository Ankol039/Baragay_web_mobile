import { HttpError } from './errors.mjs'
const encoder = new TextEncoder(), tokens = new Map()
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const json64 = value => b64url(encoder.encode(JSON.stringify(value)))
export async function googleToken(env) {
  if (env.BSS_USE_EMULATORS === 'true') return 'owner'
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new HttpError('Server configuration unavailable.', 503)
  const credential = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  if (credential.project_id !== 'barangay-survey-1cc7d') throw new HttpError('Server configuration unavailable.', 503)
  const now = Math.floor(Date.now() / 1000), saved = tokens.get(credential.client_email)
  if (saved && saved.expires > now + 300) return saved.token
  const bytes = Uint8Array.from(atob(credential.private_key.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const unsigned = json64({ alg: 'RS256', typ: 'JWT' }) + '.' + json64({ iss: credential.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned))
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(new Uint8Array(signature)) }) })
  const result = await response.json()
  if (!response.ok || !result.access_token) throw new HttpError('Server authentication unavailable.', 503)
  tokens.set(credential.client_email, { token: result.access_token, expires: now + Number(result.expires_in || 3600) })
  return result.access_token
}
export async function jsonRequest(url, body, token = null, method = body == null ? 'GET' : 'POST') {
  const headers = { Accept: 'application/json', ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  let response
  try { response = await fetch(url, { method, headers, ...(body == null ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) }) }
  catch { throw new HttpError('The system is temporarily unavailable. Please try again in a few minutes.', 503) }
  let result
  try { result = await response.json() } catch { throw new HttpError('The system is temporarily unavailable. Please try again in a few minutes.', 503) }
  return { status: response.status, body: result }
}
export async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('')
}
export async function passwordProof(env, password, operation) {
  const secret = env.OPERATION_SECRET || (env.BSS_USE_EMULATORS === 'true' ? 'local-emulator-operation-secret-only' : '')
  if (!secret || (env.BSS_USE_EMULATORS !== 'true' && secret.length < 32)) throw new HttpError('Server configuration unavailable.', 503)
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify([operation, password]))))
  return 'hmac-sha256-v1:' + b64url(bytes)
}
export async function verifyPasswordProof(env, password, operation, proof) {
  if (typeof proof !== 'string' || !proof.startsWith('hmac-sha256-v1:')) return false
  const expected = await passwordProof(env, password, operation)
  let difference = expected.length ^ proof.length
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (proof.charCodeAt(i) || 0)
  return difference === 0
}
