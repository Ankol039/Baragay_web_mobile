import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

let services
export function getFirebase() {
  if (services) return services
  const env = import.meta.env
  const options = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  if (Object.values(options).some(value => !value)) {
    throw new Error('Firebase configuration is missing. Please configure the frontend environment.')
  }
  const app = getApps().length ? getApp() : initializeApp(options)
  const auth = getAuth(app), db = getFirestore(app)
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
      Number(env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080))
  }
  services = { app, auth, db }
  return services
}
