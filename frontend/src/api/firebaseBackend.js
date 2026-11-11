import { ApiError } from './client.js'

const base = (import.meta.env.VITE_FIREBASE_API_BASE_URL || '').replace(/\/$/, '')

export function firebaseEndpoint(name) {
  if (!/^[a-z-]+(?:\.php)?$/.test(name)) throw new Error('Invalid Firebase API route.')
  if (import.meta.env.DEV) return `/api/firebase/${name}`
  if (!base) throw new ApiError('The Firebase API address is not configured.', 503)
  return `${base}/api/firebase/${name}`
}
