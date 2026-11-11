import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

// Save the complete raw before-image before the first test write. This file
// survives a killed test process, and contains emulator data only (mode 0600).
export async function preserveAccounts(db, auth, base, call) {
  assert.equal(new URL(base).hostname, '127.0.0.1')
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099')
  async function snapshot() {
    const result = new Map()
    async function walk(parent) {
      for (const collection of await parent.listCollections()) for (const ref of await collection.listDocuments()) {
        const r = await call(`${base}/${ref.path}`, 'owner')
        if (r.ok) result.set(ref.path, r.body)
        await walk(ref)
      }
    }
    await walk(db)
    return result
  }
  async function identities() {
    const users = new Map(); let pageToken
    do { const page = await auth.listUsers(1000, pageToken); for (const u of page.users) users.set(u.uid, JSON.parse(JSON.stringify(u.toJSON()))); pageToken = page.pageToken } while (pageToken)
    return users
  }
  const before = await snapshot(), originalUsers = await identities()
  const directory = mkdtempSync(join(tmpdir(), 'bss-accounts-before-')), backup = join(directory, 'before.json')
  writeFileSync(backup, JSON.stringify({ documents: [...before], auth: [...originalUsers] }), { mode: 0o600 })
  console.log(`Saved durable before-image for ${before.size} documents / ${originalUsers.size} identities at ${backup}`)
  return {
    async restore() {
      // Re-read the durable record so a cleanup bug cannot silently use guessed counters.
      const saved = JSON.parse(readFileSync(backup)), expected = new Map(saved.documents), expectedUsers = new Map(saved.auth)
      const current = await snapshot(), writes = []
      for (const [path, doc] of current) if (!expected.has(path)) writes.push({ delete: doc.name })
      for (const [path, doc] of expected) if (!isDeepStrictEqual(current.get(path)?.fields, doc.fields)) writes.push({ update: { name: doc.name, fields: doc.fields } })
      for (let i = 0; i < writes.length; i += 200) { const r = await call(`${base}:commit`, 'owner', { writes: writes.slice(i, i + 200) }); assert(r.ok, 'Restore commit') }
      for (const [uid] of await identities()) if (!expectedUsers.has(uid)) await auth.deleteUser(uid)
      const restored = await snapshot()
      assert.equal(restored.size, expected.size)
      for (const [path, doc] of expected) assert(isDeepStrictEqual(restored.get(path)?.fields, doc.fields), `Exact data restored: ${path}`)
      assert(isDeepStrictEqual(await identities(), expectedUsers), 'Original Auth identities exactly retained')
      rmSync(directory, { recursive: true })
      console.log(`Restored exact ${expected.size} documents / ${originalUsers.size} identities; durable backup removed after verification`)
    },
  }
}
