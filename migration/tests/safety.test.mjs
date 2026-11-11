import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { modeFor, externalCredential, ROOT, digest } from '../src/safety.mjs'
import { literalSettings } from '../src/mysql.mjs'
import { timestamp } from '../src/model.mjs'
import { pack, unpack } from '../src/storage.mjs'
import { Timestamp } from 'firebase-admin/firestore'
const local = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }
const code = expected => e => e.code === expected

test('dry run requires both exact loopback emulator endpoints and ignores service key variable', async () => {
  assert.equal((await modeFor(['--dry-run'], { ...local, MIGRATION_SERVICE_ACCOUNT: '/never-open-this-file' })).dryRun, true)
  for (const env of [{}, { FIRESTORE_EMULATOR_HOST: local.FIRESTORE_EMULATOR_HOST }, { ...local, FIRESTORE_EMULATOR_HOST: 'example.com:8080' }]) await assert.rejects(modeFor(['--dry-run'], env), code('LOCAL_EMULATORS_REQUIRED'))
  await assert.rejects(modeFor(['--dry-run', '--production'], local), code('MODE_CONFLICT'))
  await assert.rejects(modeFor(['--dry-run'], { ...local, GCLOUD_PROJECT: 'other' }), code('PROJECT_MISMATCH'))
})
test('production requires explicit approval and rejects mixed emulator configuration', async () => {
  await assert.rejects(modeFor([], {}), code('PRODUCTION_NOT_AUTHORIZED'))
  await assert.rejects(modeFor(['--production'], {}), code('PRODUCTION_NOT_AUTHORIZED'))
  await assert.rejects(modeFor(['--production'], { ...local, MIGRATION_APPROVE_REAL_PROJECT: 'barangay-survey-1cc7d' }), code('MODE_CONFLICT'))
})
test('service account path inside project is rejected BEFORE any contents are read', async () => {
  await assert.rejects(externalCredential({ MIGRATION_SERVICE_ACCOUNT: resolve(ROOT, 'migration/package.json') }), code('CREDENTIAL_MUST_BE_OUTSIDE_PROJECT'))
})
test('PHP settings are parsed as literals, never evaluated', () => {
  const source = "<?php define('DB_HOST','localhost');define('DB_USER','example');define('DB_PASS','not-a-real-secret');define('DB_NAME','example');define('DB_PORT',3306); dangerous_call();"
  const options = literalSettings(source)
  assert.equal(options.host, 'localhost'); assert.equal(options.port, 3306); assert.equal(options.password, 'not-a-real-secret')
  assert.throws(() => literalSettings("define('DB_PASS', getenv('SECRET'));"), code('MYSQL_ENV_OR_LITERAL_CONFIG_REQUIRED'))
})
test('dates retain Philippine calendar date; SQL event timestamps convert from +08', () => {
  assert.equal(timestamp('2026-11-10', true).toDate().toISOString(), '2026-11-10T00:00:00.000Z')
  assert.equal(timestamp('2026-11-10 08:30:00').toDate().toISOString(), '2026-11-10T00:30:00.000Z')
  assert.equal(timestamp('0000-00-00', true), null)
  assert.throws(() => timestamp('2026-02-31', true), code('INVALID_SOURCE_DATE'))
  assert(unpack(pack({ value: timestamp('2026-11-10', true) })).value instanceof Timestamp)
})
test('content fingerprints ignore map ordering but preserve values', () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }))
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }))
})
