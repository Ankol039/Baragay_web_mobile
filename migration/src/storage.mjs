import { mkdir, chmod, readFile, writeFile, rename, lstat, realpath, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { OUT, ROOT, digest, requireSafe, inside } from './safety.mjs'
export async function privateDirectory() {
  try { requireSafe(!(await lstat(OUT)).isSymbolicLink(), 'UNSAFE_OUTPUT_PATH') } catch (e) { if (e.code !== 'ENOENT') throw e }
  await mkdir(OUT, { recursive: true, mode: 0o700 }); await chmod(OUT, 0o700)
  requireSafe(await realpath(OUT) === OUT, 'UNSAFE_OUTPUT_PATH')
}
export async function savePrivate(name, data) {
  await privateDirectory(); requireSafe(/^[a-z0-9.-]+\.json$/.test(name), 'UNSAFE_OUTPUT_PATH')
  const path = resolve(OUT, name), temp = `${path}.${randomUUID()}.tmp`
  for (const file of [path, temp]) {
    try { requireSafe(!(await lstat(file)).isSymbolicLink() && (await lstat(file)).nlink === 1, 'UNSAFE_OUTPUT_PATH') } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
  await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await chmod(temp, 0o600)
  await rename(temp, path)
}
export async function loadPrivate(name) {
  await privateDirectory(); requireSafe(/^[a-z0-9.-]+\.json$/.test(name), 'UNSAFE_OUTPUT_PATH'); const path = resolve(OUT, name)
  requireSafe(!(await lstat(path)).isSymbolicLink() && (await lstat(path)).nlink === 1, 'UNSAFE_OUTPUT_PATH')
  requireSafe(inside(OUT, await realpath(path)), 'UNSAFE_OUTPUT_PATH')
  return JSON.parse(await readFile(path, 'utf8'))
}
export function pack(v) {
  if (v instanceof Timestamp) return { __firestoreTimestamp: [v.seconds, v.nanoseconds] }
  if (Array.isArray(v)) return v.map(pack)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x)]))
  return v
}
export function unpack(v) {
  if (v && typeof v === 'object' && Object.keys(v).length === 1 && Array.isArray(v.__firestoreTimestamp)) return new Timestamp(...v.__firestoreTimestamp)
  if (Array.isArray(v)) return v.map(unpack)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unpack(x)]))
  return v
}
export async function sourceDigest() {
  const dir = resolve(ROOT, 'migration/src'), names = (await readdir(dir)).filter(n => n.endsWith('.mjs')).sort()
  const data = await Promise.all(names.map(async name => [name, await readFile(resolve(dir, name), 'utf8')]))
  return digest(data)
}
