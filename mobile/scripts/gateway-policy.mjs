import { isIP } from 'node:net'
export const apiPaths = new Set(['index.php', 'accounts.php', 'resident-read.php', 'resident-profile.php', 'survey-schema.php'])
export function privateIPv4(host) {
  if (isIP(host) !== 4) return false
  const [a, b] = host.split('.').map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}
export function decoded(value) {
  let text = String(value)
  for (let i = 0; i < 8; i++) {
    const escaped = text.replace(/\\u([a-f0-9]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    try { const next = decodeURIComponent(escaped); if (next === text) break; text = next } catch { text = escaped; break }
  }
  return text
}
export function allowRequest(kind, method, url, headers = {}, body = '', project = '') {
  if (!['GET', 'POST', 'OPTIONS'].includes(method)) return false
  let parsed
  try { parsed = new URL(url, 'http://localhost') } catch { return false }
  const path = decoded(parsed.pathname)
  const credentials = decoded(`${url} ${JSON.stringify(headers)} ${body}`).replace(/\\["/]/g, '')
  // WebChannel may carry Authorization in URL-encoded $httpHeaders or form data.
  if (/(?:bearer[\s"':=\\]+owner\b|authorization[\s"':=\\]+owner\b)/i.test(credentials)) return false
  if (/(?:\/emulator|\/admin|%2f|\.\.)/i.test(path)) return false
  if (kind === 'api') return /^\/api\/firebase\/[^/]+$/.test(path) && apiPaths.has(path.split('/').pop())
  if (kind === 'auth') return /^\/identitytoolkit\.googleapis\.com\/v1\/accounts:(?:signInWithPassword|lookup)$/.test(path)
    || /^\/securetoken\.googleapis\.com\/v1\/token$/.test(path)
  if (kind === 'firestore') {
    if (!project || !/^[a-z0-9-]+$/.test(project)) return false
    const resource = `projects/${project}/databases/(default)`
    if (/^\/google\.firestore\.v1\.Firestore\/Listen\/channel$/.test(path)) {
      return parsed.searchParams.get('database') === resource
    }
    const prefix = `/v1/${resource}/documents`
    return path.startsWith(prefix) && /^(?::(?:batchGet|commit|runQuery)|(?:\/[^/]+)+)?$/.test(path.slice(prefix.length))
  }
  return false
}
