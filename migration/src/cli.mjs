import { modeFor, requireSafe, MigrationError } from './safety.mjs'
import { loadPrivate, savePrivate, unpack, pack, sourceDigest } from './storage.mjs'
import { exportMysql } from './mysql.mjs'
import { savePlan, transform } from './transform.mjs'
import { targetFor } from './firebase.mjs'
import { migrateAuth } from './auth.mjs'
import { importFirestore } from './import.mjs'
import { verifyTarget } from './verify.mjs'
const args = process.argv.slice(2), step = args[0] || 'all'
let target
try {
  requireSafe(['all', 'export', 'transform', 'auth', 'import', 'verify'].includes(step), 'INVALID_STEP')
  requireSafe(args.slice(1).every(a => ['--dry-run', '--production', '--check-idempotency', '--acknowledge-source-warnings'].includes(a)), 'INVALID_OPTION')
  const mode = await modeFor(args)
  let snapshot, plan
  if (['all', 'export'].includes(step)) {
    snapshot = await exportMysql()
    console.log(`Export complete: ${Object.keys(snapshot.counts).length} tables, ${Object.values(snapshot.counts).reduce((a, b) => a + b, 0)} rows; private output ignored.`)
  }
  if (step !== 'export') {
    if (['all', 'transform'].includes(step)) plan = await savePlan(snapshot || await loadPrivate('mysql-export.json'))
    else {
      const stored = unpack(await loadPrivate('firestore-plan.json'))
      plan = transform(await loadPrivate('mysql-export.json'))
      requireSafe(stored.snapshotDigest === plan.snapshotDigest, 'PLAN_SNAPSHOT_MISMATCH')
      if (step === 'verify') {
        const checkpoint = await loadPrivate(mode.dryRun ? 'auth-emulator.json' : 'auth-production.json')
        for (const account of plan.authUsers) {
          const status = checkpoint.accounts[account.uid]
          requireSafe(status?.sourceFingerprint === account.sourceFingerprint, 'AUTH_STEP_REQUIRED')
          plan.records.find(r => r.path === `users/${account.uid}`).data.isFirstLogin = account.sourceIsFirstLogin || status.forceFirstLogin
        }
        plan.authSummary = stored.authSummary
      }
    }
    console.log(`Transform available: ${plan.records.length} documents, ${plan.authUsers.length} Auth accounts.`)
  }
  if (!['export', 'transform'].includes(step)) {
    target = await targetFor(mode, plan, args)
    let authSummary = plan.authSummary
    if (step !== 'verify') {
      authSummary = await migrateAuth(target.auth, plan, mode)
      plan.authSummary = authSummary
      await savePrivate('firestore-plan.json', pack(plan))
      console.log(`Auth complete: ${plan.authUsers.length} accounts; method totals will appear in the verification report.`)
    }
    if (['all', 'import'].includes(step)) {
      const imported = await importFirestore(target.db, plan)
      console.log(`Import complete: ${imported.written} new documents; ${imported.unchanged} unchanged documents.`)
    }
    if (['all', 'import', 'verify'].includes(step)) {
      requireSafe(authSummary, 'AUTH_STEP_REQUIRED')
      let idempotency = null
      if (args.includes('--check-idempotency')) {
        const againAuth = await migrateAuth(target.auth, plan, mode), again = await importFirestore(target.db, plan)
        idempotency = { passed: again.written === 0 && again.countersAdvanced === 0 && againAuth.reused === plan.authUsers.length,
          written: again.written, countersAdvanced: again.countersAdvanced, authReused: againAuth.reused }
        requireSafe(idempotency.passed, 'IDEMPOTENCY_FAILED')
      }
      const verified = await verifyTarget(target, plan, mode, authSummary, idempotency)
      if (mode.dryRun) await savePrivate('verified-emulator.json', { passed: verified.passed, snapshotDigest: plan.snapshotDigest, codeDigest: await sourceDigest(), capturedAt: verified.capturedAt })
      console.log('Verification PASS: collection counts, exact contents and required relations match. See docs/migration-verification.md for source-data warnings.')
    }
  }
} catch (error) {
  // SDK/MySQL exceptions can include identifiers, passwords or credential paths.
  // Never pass their message/stack/objects to the console or a tracked file.
  const safeCode = error instanceof MigrationError ? error.code : typeof error.code === 'string' && /^(auth|firestore)\/[a-z-]+$/.test(error.code) ? error.code : 'UNEXPECTED_OPERATION_FAILURE'
  await savePrivate('failure.json', { code: safeCode, errorType: error.name, locations: String(error.stack || '').split('\n').filter(line => line.includes('/migration/src/')).map(line => line.match(/src\/[a-z.-]+:[0-9]+:[0-9]+/)?.[0]).filter(Boolean) })
  console.error(`Migration stopped: ${safeCode}. No private error details printed.`)
  process.exitCode = 1
} finally { if (target) await target.close() }
