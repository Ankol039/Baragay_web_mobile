import { initializeApp, cert, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { externalCredential, requireSafe, digest } from './safety.mjs'
import { loadPrivate, sourceDigest } from './storage.mjs'
export async function targetFor(mode, plan, args) {
  if (!mode.dryRun) {
    const proof = await loadPrivate('verified-emulator.json')
    requireSafe(proof.passed && proof.snapshotDigest === plan.snapshotDigest && proof.codeDigest === await sourceDigest(), 'MATCHING_EMULATOR_PROOF_REQUIRED')
    requireSafe(args.includes('--acknowledge-source-warnings') || !Object.values(plan.warnings).some(Boolean), 'SOURCE_WARNINGS_REQUIRE_REVIEW')
  }
  // Official emulator setup: Auth uses its emulator credential and Firestore's
  // insecure local channel bypasses ADC. No credential path/file is loaded.
  const credentials = mode.dryRun ? {} : { credential: cert(await externalCredential()) }
  const app = initializeApp({ projectId: mode.projectId, ...credentials }, `migration-${digest(String(Date.now())).slice(0, 12)}`)
  return { auth: getAuth(app), db: getFirestore(app), close: () => deleteApp(app) }
}
