import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const frontend = fileURLToPath(new URL('../', import.meta.url))
export const project = JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url))).projects.default
export const emulatorEnv = {
  ...process.env, GCLOUD_PROJECT: project,
  BSS_USE_EMULATORS: 'true', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  VITE_USE_EMULATORS: 'true', VITE_FIREBASE_API_KEY: 'emulator-only',
  VITE_FIREBASE_PROJECT_ID: project, VITE_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`, VITE_FIREBASE_APP_ID: 'emulator-only',
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1', VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: '8080',
}
export function startAuthDev() {
  const php = spawn(process.env.PHP_BINARY || 'php', ['-S', '127.0.0.1:8787', '-t', root], { cwd: root, env: emulatorEnv, stdio: 'ignore' })
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    { cwd: frontend, env: emulatorEnv, stdio: 'ignore' })
  const stop = () => { php.kill(); vite.kill() }
  for (const child of [php, vite]) child.on('error', stop)
  return { php, vite, stop }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { php, vite, stop } = startAuthDev()
  console.log('Local Firebase auth app: http://127.0.0.1:5173/barangay_survey_system/app/login')
  console.log('Start the existing Auth/Firestore emulators separately with npm run emulators:start.')
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stop(); process.exit() })
  for (const child of [php, vite]) child.on('exit', code => { stop(); process.exit(code || 0) })
}
