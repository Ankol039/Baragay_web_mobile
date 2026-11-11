import { loadPrivate, savePrivate } from './storage.mjs'
import { requireSafe } from './safety.mjs'
export async function maybeUser(auth, id) {
  try { return await auth.getUser(id) } catch (e) { if (e.code === 'auth/user-not-found') return null; throw e }
}
const hashFailure = code => ['auth/invalid-password-hash', 'auth/invalid-hash-algorithm', 'auth/invalid-hash-key', 'auth/invalid-hash-salt-separator'].includes(code)
export async function importCredential(auth, account, dryRun) {
  const record = { uid: account.uid, email: account.email, displayName: account.displayName, disabled: account.disabled }
  const bcrypt = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(account.passwordHash)
  let accepted = false
  if (bcrypt) {
    try {
      const result = await auth.importUsers([{ ...record, passwordHash: Buffer.from(account.passwordHash, 'utf8') }], { hash: { algorithm: 'BCRYPT' } })
      if (result.failureCount) { requireSafe(result.errors.every(e => hashFailure(e.error.code)), 'AUTH_IMPORT_FAILED') }
      else accepted = true
    } catch (e) { if (!hashFailure(e.code)) throw e }
  }
  if (accepted && !dryRun) return { method: 'bcrypt', bcryptAttempted: true, bcryptAccepted: true, forceFirstLogin: false }
  // The Auth emulator stores import payloads but does NOT implement BCRYPT
  // verification. Use functional temporary credentials ONLY in that emulator.
  if (accepted) await auth.updateUser(account.uid, { password: account.identifier })
  else {
    requireSafe(!await maybeUser(auth, account.uid), 'PARTIAL_AUTH_IMPORT_REQUIRES_REVIEW')
    await auth.createUser({ ...record, password: account.identifier })
  }
  return { method: dryRun && accepted ? 'emulator-temporary' : 'temporary', bcryptAttempted: bcrypt, bcryptAccepted: accepted, forceFirstLogin: true }
}
export async function migrateAuth(auth, plan, mode) {
  const filename = mode.dryRun ? 'auth-emulator.json' : 'auth-production.json'
  let checkpoint
  try { checkpoint = await loadPrivate(filename) } catch (e) { if (e.code !== 'ENOENT') throw e; checkpoint = { projectId: mode.projectId, accounts: {} } }
  requireSafe(checkpoint.projectId === mode.projectId, 'AUTH_CHECKPOINT_PROJECT_MISMATCH')
  // Preflight ALL identities before changing any credentials. No overwriting an
  // unrelated UID/email, and no resetting existing passwords on a rerun.
  const existing = new Map()
  for (const account of plan.authUsers) {
    const target = await maybeUser(auth, account.uid)
    if (target) {
      const saved = checkpoint.accounts[account.uid]
      requireSafe(saved && saved.sourceFingerprint === account.sourceFingerprint && target.email === account.email && target.disabled === account.disabled, 'EXISTING_AUTH_REQUIRES_REVIEW')
      existing.set(account.uid, saved)
    } else {
      try { await auth.getUserByEmail(account.email); requireSafe(false, 'EXISTING_EMAIL_REQUIRES_REVIEW') }
      catch (e) { if (e.code !== 'auth/user-not-found') throw e }
    }
  }
  const summary = { bcryptAttempted: 0, bcryptAccepted: 0, bcryptUsed: 0, temporaryUsed: 0, emulatorTemporaryUsed: 0, reused: 0 }
  for (const account of plan.authUsers) {
    let result = existing.get(account.uid)
    if (result) summary.reused++
    else {
      result = { ...await importCredential(auth, account, mode.dryRun), sourceFingerprint: account.sourceFingerprint }
      checkpoint.accounts[account.uid] = result
      await savePrivate(filename, checkpoint)
    }
    if (result.bcryptAttempted) summary.bcryptAttempted++
    if (result.bcryptAccepted) summary.bcryptAccepted++
    if (result.method === 'bcrypt') summary.bcryptUsed++
    else if (result.method === 'emulator-temporary') summary.emulatorTemporaryUsed++
    else summary.temporaryUsed++
    plan.records.find(r => r.path === `users/${account.uid}`).data.isFirstLogin = account.sourceIsFirstLogin || result.forceFirstLogin
  }
  return summary
}
