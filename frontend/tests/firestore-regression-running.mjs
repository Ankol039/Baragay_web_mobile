// Run the reset-based legacy rule suite while preserving the user's local emulator data.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { readFile } from 'node:fs/promises'
import { emulatorEnv, project } from '../scripts/auth-dev.mjs'
Object.assign(process.env, emulatorEnv)
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099')
const require = createRequire(new URL('../../migration/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const app = initializeApp({ projectId: project }, 'local-rule-regression')
const db = getFirestore(app), auth = getAuth(app)
async function documents() {
  const result = new Map()
  async function walk(parent) {
    for (const collection of await parent.listCollections()) {
      for (const ref of await collection.listDocuments()) {
        const snapshot = await ref.get()
        if (snapshot.exists) result.set(ref.path, snapshot.data())
        await walk(ref)
      }
    }
  }
  await walk(db)
  return result
}
async function identities() {
  const ids = new Set()
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    page.users.forEach(user => ids.add(user.uid)); pageToken = page.pageToken
  } while (pageToken)
  return ids
}
const before = await documents(), originalUsers = await identities()
console.log(`Preserving ${before.size} local documents and ${originalUsers.size} emulator identities in memory.`)
let exitCode = 1
try {
  // Compile this worktree's rules explicitly. A running suite may have started
  // from a different checkout; testing its old rules would hide regressions.
  const loaded = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${project}:securityRules`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules',
      content: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') }] } }),
  })
  assert(loaded.ok, `Current worktree rules failed emulator compilation (${loaded.status})`)
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', '--test-concurrency=1', 'tests/firestore-emulator.test.mjs'], { stdio: 'inherit', env: emulatorEnv })
    child.on('error', reject); child.on('exit', code => resolve(code ?? 1))
  })
} finally {
  const after = await documents()
  const operations = [...after.keys()].filter(path => !before.has(path)).map(path => ({ path }))
  for (const [path, data] of before) operations.push({ path, data })
  for (let i = 0; i < operations.length; i += 200) {
    const batch = db.batch()
    for (const { path, data } of operations.slice(i, i + 200)) {
      if (data) batch.set(db.doc(path), data); else batch.delete(db.doc(path))
    }
    await batch.commit()
  }
  for (const uid of await identities()) if (!originalUsers.has(uid)) await auth.deleteUser(uid)
  const restored = await documents()
  assert(isDeepStrictEqual(restored, before), 'Exact original emulator documents restored')
  assert(isDeepStrictEqual(await identities(), originalUsers), 'Original emulator identities retained')
  console.log(`Restored all ${before.size} original local documents; removed only regression fixtures.`)
  await db.terminate(); await deleteApp(app)
}
process.exitCode = exitCode
