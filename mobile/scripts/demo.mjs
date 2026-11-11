import { spawnSync, spawn } from 'node:child_process'
import { emulatorEnv } from './emulator-env.mjs'
const env = emulatorEnv()
const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], { stdio: 'inherit', env })
if (result.status) process.exit(result.status)
if (process.argv.includes('--build-only')) process.exit(0)
const server = spawn(process.execPath, ['scripts/lan-gateway.mjs'], { stdio: 'inherit', env })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('exit', code => process.exit(code || 0))
