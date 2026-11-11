/** Local real-project runtime; external ADC stays server-side and refreshes. */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, realpath, writeFile, rename, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isIP } from 'node:net'

const frontend = fileURLToPath(new URL('..', import.meta.url))
const root = dirname(frontend.replace(/\/$/, ''))
const project = JSON.parse(await readFile(join(root, '.firebaserc'), 'utf8')).projects.default
const inside = (parent, path) => { const rel = relative(parent, path); return !rel || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) }
const host = process.env.BSS_LIVE_HOST || '127.0.0.1'
const privateHost = isIP(host) === 4 && (host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host))
const port = Number(process.env.BSS_LIVE_PORT || 8788)
if (project !== 'barangay-survey-1cc7d' || (host !== '127.0.0.1' && !privateHost)
  || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid real-project runtime target.')
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credentialPath || inside(await realpath(root), await realpath(credentialPath))) throw new Error('An external server credential is required.')

const config = {}
for (const line of (await readFile(join(frontend, '.env.local'), 'utf8')).split('\n')) {
  const match = line.match(/^(VITE_FIREBASE_(?:API_KEY|AUTH_DOMAIN|PROJECT_ID|APP_ID))=(.*)$/)
  if (match) config[match[1]] = match[2].trim()
}
if (Object.keys(config).length !== 4 || Object.values(config).some(v => !v)
  || config.VITE_FIREBASE_PROJECT_ID !== project) throw new Error('Configure the existing Firebase web app in frontend/.env.local.')

const require = createRequire(join(root, 'migration/package.json'))
const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app')
const credential = applicationDefault(), app = initializeApp({ projectId: project, credential }, 'local-live-runtime')
const temp = await mkdtemp(join(tmpdir(), 'bss-live-'))
const tokenPath = join(temp, 'bridge-token'), dist = join(temp, 'web')
let child, timer, refreshing = false, stopped = false
async function refresh() {
  if (refreshing) return
  refreshing = true
  try {
    const token = await credential.getAccessToken()
    if (!token.access_token) throw new Error('Missing token')
    await writeFile(tokenPath + '.next', token.access_token, { mode: 0o600 })
    await rename(tokenPath + '.next', tokenPath)
  } finally { refreshing = false }
}
async function stop() {
  if (stopped) return
  stopped = true; clearInterval(timer)
  if (child?.pid && child.exitCode === null && !child.signalCode) {
    const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done
  }
  await deleteApp(app)
  await rm(temp, { recursive: true, force: true })
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop().then(() => process.exit(0)) })
try {
  await refresh()
  const env = { ...process.env, ...config, VITE_USE_EMULATORS: 'false' }
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'BSS_USE_EMULATORS', 'FIREBASE_BRIDGE_ACCESS_TOKEN']) delete env[key]
  const build = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--base=/', '--outDir', dist], { cwd: frontend, env, stdio: 'inherit' })
  const code = await new Promise((resolve, reject) => { build.on('error', reject); build.on('exit', resolve) })
  if (code) throw new Error('Real-project build failed')
  const serverEnv = { ...env, FIREBASE_WEB_API_KEY: config.VITE_FIREBASE_API_KEY,
    FIREBASE_BRIDGE_TOKEN_FILE: tokenPath, BSS_FRONTEND_DIST: dist }
  delete serverEnv.GOOGLE_APPLICATION_CREDENTIALS; delete serverEnv.MIGRATION_SERVICE_ACCOUNT
  child = spawn(process.env.PHP_BINARY || 'php', ['-S', `${host}:${port}`, '-t', dist, join(root, 'api/firebase/router.php')], { cwd: root, env: serverEnv, stdio: 'ignore' })
  child.on('error', () => { console.error('Real-project API failed to start.'); void stop() })
  child.on('exit', () => { if (!stopped) void stop() })
  timer = setInterval(() => { void refresh().catch(() => console.error('Server credential refresh failed; retrying.')) }, 60000)
  console.log(`Real Firebase website/API: http://${host}:${port}/ (${project})`)
  console.log('External credential stays server-side; this runtime does not deploy or import data.')
} catch {
  console.error('Real-project runtime failed. Check external credentials and public configuration; no private error details displayed.')
  await stop(); process.exitCode = 1
}
