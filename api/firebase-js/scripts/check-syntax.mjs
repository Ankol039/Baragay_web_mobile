import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const files = []
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.wrangler') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (entry.isFile() && path.endsWith('.mjs')) files.push(path)
  }
}
await collect(root)
let failed = false
for (const path of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' })
  if (result.status !== 0) failed = true
}
if (failed) process.exitCode = 1
else console.log(`Syntax OK: ${files.length} JavaScript modules.`)
