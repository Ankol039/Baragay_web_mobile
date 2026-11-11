import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const transport = fileURLToPath(new URL('../../api/firebase/transport.php', import.meta.url))
const source = `require $argv[1]; try { $c=fb_config(); echo $c['access']==='synthetic-token' ? 'ACCEPT' : 'WRONG'; } catch (Throwable $e) { echo 'REFUSE'; }`
function check(file, access = '') {
  return execFileSync(process.env.PHP_BINARY || 'php', ['-r', source, transport], {
    encoding: 'utf8', env: { ...process.env, BSS_USE_EMULATORS: 'false',
      FIREBASE_BRIDGE_TOKEN_FILE: file, FIREBASE_BRIDGE_ACCESS_TOKEN: access, FIREBASE_WEB_API_KEY: 'synthetic-key' },
  })
}
test('host tokens rotate between requests while insecure/missing/oversized files are refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bss-token-test-')), file = join(dir, 'token')
  try {
    await writeFile(file, 'synthetic-token', { mode: 0o600 })
    assert.equal(check(file), 'ACCEPT')
    await writeFile(file, 'old-token')
    assert.equal(check(file), 'WRONG')
    await writeFile(file, 'synthetic-token')
    assert.equal(check(file), 'ACCEPT')
    await chmod(file, 0o644)
    assert.equal(check(file), 'REFUSE')
    await chmod(file, 0o600); await writeFile(file, 'A'.repeat(16385))
    assert.equal(check(file), 'REFUSE')
    assert.equal(check(join(dir, 'missing')), 'REFUSE')
    assert.equal(check(dir), 'REFUSE')
    assert.equal(check(transport), 'REFUSE')
    assert.equal(check('', 'synthetic-token'), 'ACCEPT')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
test('real launcher rejects credentials inside the app even when their filename starts with two dots', async () => {
  const file = fileURLToPath(new URL(`../..synthetic-${randomUUID()}.json`, import.meta.url))
  try {
    await writeFile(file, 'synthetic fixture', { mode: 0o600 })
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/firebase-live.mjs', import.meta.url))], {
      encoding: 'utf8', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: file, BSS_LIVE_HOST: '127.0.0.1', BSS_LIVE_PORT: '8788' },
    })
    assert.notEqual(child.status, 0)
    assert.match(child.stderr, /An external server credential is required/)
  } finally { await rm(file, { force: true }) }
})
