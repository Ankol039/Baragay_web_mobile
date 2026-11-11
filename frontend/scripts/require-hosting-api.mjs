const value = process.env.VITE_FIREBASE_API_BASE_URL || ''
let url
try { url = new URL(value) } catch { throw new Error('Set VITE_FIREBASE_API_BASE_URL to the deployed HTTPS JavaScript API before Firebase Hosting deployment.') }
if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  throw new Error('VITE_FIREBASE_API_BASE_URL must be the HTTPS Cloudflare Worker origin (without a path).')
}
