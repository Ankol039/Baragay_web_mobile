import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { emulatorEnv, frontend, root } from './auth-dev.mjs'

export function startFirebaseRuntime(port = 8787) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local runtime port.')
  if (!existsSync(`${frontend}/dist/index.html`)) throw new Error('Run npm run build:demo first.')
  // A narrow router replaces serving the repository as a public document root.
  return spawn(process.env.PHP_BINARY || 'php', ['-S', `127.0.0.1:${port}`, '-t', `${frontend}/dist`,
    `${root}/api/firebase/router.php`], { cwd: root, env: emulatorEnv, stdio: 'ignore' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const buildOnly = process.argv.includes('--build-only')
  if (buildOnly || process.argv.includes('--build')) {
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--base=/'],
      { cwd: frontend, env: emulatorEnv, stdio: 'inherit' })
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject); child.on('exit', result => resolve(result ?? 1))
    })
    if (code || buildOnly) process.exit(code)
  }
  const port = Number(process.env.BSS_RUNTIME_PORT || 8787)
  const child = startFirebaseRuntime(port)
  let stopping = false
  const stop = () => { stopping = true; child.kill() }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop)
  child.on('error', () => { console.error('Unable to start the standalone PHP runtime.'); process.exitCode = 1 })
  child.on('exit', code => { if (!stopping) process.exitCode = code ?? 1 })
  console.log(`React + Firebase emulator demo: http://127.0.0.1:${port}/`)
  console.log('Requires Auth/Firestore emulators; XAMPP Apache/MySQL are not used by migrated screens.')
}
