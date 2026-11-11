import { spawn } from 'node:child_process'
import { emulatorEnv } from './emulator-env.mjs'
const env = emulatorEnv()
const child = spawn('npx', ['expo', 'start', '--lan'], { stdio: 'inherit', env })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code || 0))
