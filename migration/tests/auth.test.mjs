import assert from 'node:assert/strict'
import test from 'node:test'
import { importCredential } from '../src/auth.mjs'
const account = { uid: 'example-1', email: 'example@barangay.app', displayName: 'Example', disabled: false, identifier: 'R-2026-0001', passwordHash: '$2y$10$' + 'A'.repeat(53) }
function mock(result = { successCount: 1, failureCount: 0, errors: [] }) {
  const calls = []
  return { calls, importUsers: async (users, options) => { calls.push(['import', users, options]); return result }, updateUser: async (uid, data) => { calls.push(['update', uid, data]) },
    getUser: async () => { const e = new Error(); e.code = 'auth/user-not-found'; throw e }, createUser: async data => { calls.push(['create', data]) } }
}
test('production code path passes original PHP bcrypt bytes to BCRYPT (mock)', async () => {
  const auth = mock(), r = await importCredential(auth, account, false)
  assert.equal(r.method, 'bcrypt'); assert.equal(r.forceFirstLogin, false)
  assert.equal(auth.calls[0][1][0].passwordHash.toString(), account.passwordHash)
  assert.equal(auth.calls[0][2].hash.algorithm, 'BCRYPT'); assert.equal(auth.calls.length, 1)
})
test('emulator hash acceptance is reported separately from functional temporary credential', async () => {
  const auth = mock(), r = await importCredential(auth, account, true)
  assert.equal(r.method, 'emulator-temporary'); assert.equal(r.bcryptAccepted, true); assert.equal(r.forceFirstLogin, true)
  assert.equal(auth.calls[1][2].password, account.identifier)
})
test('hash-related rejection falls back to identifier and forced first login', async () => {
  const auth = mock({ failureCount: 1, errors: [{ error: { code: 'auth/invalid-password-hash' } }] })
  const r = await importCredential(auth, account, false)
  assert.equal(r.method, 'temporary'); assert.equal(r.forceFirstLogin, true)
  assert.equal(auth.calls.at(-1)[1].password, account.identifier)
})
test('unsupported source hash uses explicit temporary fallback; unrelated failures do not', async () => {
  const auth = mock(); assert.equal((await importCredential(auth, { ...account, passwordHash: 'unsupported' }, false)).method, 'temporary')
  const bad = mock({ failureCount: 1, errors: [{ error: { code: 'auth/invalid-email' } }] })
  await assert.rejects(importCredential(bad, account, false), e => e.code === 'AUTH_IMPORT_FAILED')
  assert.equal(bad.calls.length, 1)
})
