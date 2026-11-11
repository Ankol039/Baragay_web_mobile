import { readFileSync } from 'node:fs'
import { privateIPv4 } from './gateway-policy.mjs'
export const project = JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url))).projects.default
export function emulatorEnv() {
  const host = process.env.MOBILE_LAN_HOST || '127.0.0.1'
  if (host !== '127.0.0.1' && (!privateIPv4(host) || process.env.MOBILE_TRUSTED_LAN_DEMO !== 'I_UNDERSTAND_EMULATOR_TOKENS_ARE_INSECURE')) throw new Error('Choose an explicit private IPv4 interface and acknowledge the trusted-LAN emulator demo.')
  return { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_FIREBASE_API_KEY: 'emulator-only', EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: project, EXPO_PUBLIC_FIREBASE_APP_ID: 'emulator-only', EXPO_PUBLIC_USE_EMULATORS: 'true',
    EXPO_PUBLIC_API_BASE_URL: `http://${host}:8790`, EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: host, EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: '8791', EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT: '8792' }
}
