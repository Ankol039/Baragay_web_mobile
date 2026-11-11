import { handleMemberApp } from './member-app.mjs'
import { HttpError } from './core/errors.mjs'
import { createContext } from './core/context.mjs'
import { handleAuth } from './auth.mjs'
import { handleResidentRead } from './resident-read.mjs'
import { handleResidentProfile } from './resident-profile.mjs'
import { handleSurveySchema } from './survey-schema.mjs'
import { handleAccounts } from './accounts.mjs'
import { handleReports } from './reports.mjs'
import { handleStaffSurveys } from './staff.mjs'

const routes = new Map([
  ['/api/firebase/member-app', 'memberApp'],
  ['/api/firebase/auth', 'auth'],
  ['/api/firebase/resident-read', 'resident'],
  ['/api/firebase/survey-schema', 'schema'],
  ['/api/firebase/resident-profile', 'profile'],
  ['/api/firebase/accounts', 'accounts'],
  ['/api/firebase/staff-reports', 'reports'],
  ['/api/firebase/staff-surveys', 'surveys'],
  // Retain the old bridge paths as URL aliases during the cutover. The Worker
  // handles them as JavaScript routes; Firebase Hosting serves no PHP handlers.
  ['/api/firebase/index.php', 'auth'], ['/firebase-auth.php', 'auth'],
  ['/api/firebase/resident-read.php', 'resident'], ['/firebase-resident.php', 'resident'],
  ['/api/firebase/survey-schema.php', 'schema'], ['/firebase-survey.php', 'schema'],
  ['/api/firebase/resident-profile.php', 'profile'], ['/firebase-profile.php', 'profile'],
  ['/api/firebase/accounts.php', 'accounts'], ['/firebase-accounts.php', 'accounts'],
  ['/api/firebase/staff-reports.php', 'reports'], ['/firebase-staff-reports.php', 'reports'],
  ['/api/firebase/staff-surveys.php', 'surveys'], ['/firebase-staff-surveys.php', 'surveys'],
])
const maxBody = 1048576
const origins = env => new Set((env.ALLOWED_ORIGINS || 'https://barangay-survey-1cc7d.web.app,https://barangay-survey-1cc7d.firebaseapp.com,http://127.0.0.1:8787,http://localhost:5173,http://127.0.0.1:8790,http://localhost:8790,http://127.0.0.1:8081,http://localhost:8081')
  .split(',').map(value => value.trim()).filter(Boolean))
function corsHeaders(request, env) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  const origin = request.headers.get('origin')
  if (origin && origins(env).has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type')
    headers.set('Vary', 'Origin')
  }
  return headers
}
function json(body, status, headers) {
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}
async function readBody(request) {
  if (!request.body) return { input: {}, size: 0 }
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBody) throw new HttpError('Invalid request.', 413)
  const reader = request.body.getReader(), chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBody) { await reader.cancel(); throw new HttpError('Invalid request.', 413) }
    chunks.push(value)
  }
  if (!size) return { input: {}, size: 0 }
  const contentType = (request.headers.get('content-type') || '').split(';', 1)[0].toLowerCase()
  if (contentType !== 'application/json') throw new HttpError('Unsupported request content type.', 415)
  let input
  try { input = JSON.parse(new TextDecoder().decode(BufferlessConcat(chunks, size))) }
  catch { throw new HttpError('Invalid JSON request.', 400) }
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new HttpError('Invalid JSON request.', 400)
  return { input, size }
}
function BufferlessConcat(chunks, size) {
  const out = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return out
}
async function route(request, env) {
  const url = new URL(request.url), name = routes.get(url.pathname)
  if (!name) throw new HttpError('Not found.', 404)
  if (request.method === 'OPTIONS') return { preflight: true }
  if (!['GET', 'POST'].includes(request.method)) throw new HttpError('Method not allowed.', 405)
  const { input, size } = await readBody(request)
  const ctx = createContext(request, env, input, size)
  let result
  if (name === 'memberApp') result = await handleMemberApp(ctx, input.action || '', input)
  else if (name === 'auth') result = await handleAuth(ctx, url.searchParams.get('action') || '', input)
  else if (name === 'resident') result = await handleResidentRead(ctx, input.action || '', input)
  else if (name === 'schema') result = await handleSurveySchema(ctx, input.action || '', input)
  else if (name === 'profile') result = await handleResidentProfile(ctx, input.action || '', input)
  else if (name === 'accounts') result = await handleAccounts(ctx, input.action || '', input)
  else if (name === 'reports') result = await handleReports(ctx, input.action || '', input)
  else result = await handleStaffSurveys(ctx, input.action || '', input)
  return { result }
}
export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env)
    const origin = request.headers.get('origin')
    if (origin && !origins(env).has(origin)) return json({ ok: false, message: 'Access denied.' }, 403, headers)
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      const { result, preflight } = await route(request, env)
      if (preflight) return new Response(null, { status: 204, headers })
      return json(result, 200, headers)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      const message = error instanceof HttpError ? error.message : 'The system is temporarily unavailable. Please try again in a few minutes.'
      return json({ ok: false, message }, status, headers)
    }
  },
}
