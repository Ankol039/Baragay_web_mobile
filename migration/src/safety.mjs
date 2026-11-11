import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const OUT = resolve(ROOT, 'migration/out')
export class MigrationError extends Error { constructor(code) { super(code); this.code = code } }
export function requireSafe(ok, code) { if (!ok) throw new MigrationError(code) }
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v
export const digest = data => createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(canonical(data))).digest('hex')
export function inside(root, file) { const rel = relative(root, file); return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)) }
export async function modeFor(args, env = process.env) {
  const config = JSON.parse(await readFile(resolve(ROOT, 'firebase.json'), 'utf8'))
  const projectId = JSON.parse(await readFile(resolve(ROOT, '.firebaserc'), 'utf8')).projects.default
  requireSafe(projectId === 'barangay-survey-1cc7d', 'PROJECT_MISMATCH')
  if (args.includes('--dry-run')) {
    requireSafe(!args.includes('--production'), 'MODE_CONFLICT')
    requireSafe(env.FIRESTORE_EMULATOR_HOST === `127.0.0.1:${config.emulators.firestore.port}`
      && env.FIREBASE_AUTH_EMULATOR_HOST === `127.0.0.1:${config.emulators.auth.port}`, 'LOCAL_EMULATORS_REQUIRED')
    requireSafe(!env.GCLOUD_PROJECT || env.GCLOUD_PROJECT === projectId, 'PROJECT_MISMATCH')
    return { projectId, dryRun: true }
  }
  requireSafe(args.includes('--production') && env.MIGRATION_APPROVE_REAL_PROJECT === projectId, 'PRODUCTION_NOT_AUTHORIZED')
  requireSafe(!env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_AUTH_EMULATOR_HOST, 'MODE_CONFLICT')
  return { projectId, dryRun: false }
}
export async function externalCredential(env = process.env) {
  // Called only by the explicitly approved production branch. No path is logged.
  requireSafe(Boolean(env.MIGRATION_SERVICE_ACCOUNT), 'EXTERNAL_CREDENTIAL_REQUIRED')
  const [root, path] = await Promise.all([realpath(ROOT), realpath(env.MIGRATION_SERVICE_ACCOUNT)])
  requireSafe(!inside(root, path), 'CREDENTIAL_MUST_BE_OUTSIDE_PROJECT')
  const key = JSON.parse(await readFile(path, 'utf8'))
  requireSafe(key.project_id === 'barangay-survey-1cc7d', 'CREDENTIAL_PROJECT_MISMATCH')
  return key
}
