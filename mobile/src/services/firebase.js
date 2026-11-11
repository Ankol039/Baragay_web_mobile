import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, initializeAuth, getReactNativePersistence } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
let services
export function getFirebase() {
  if (services) return services
  const options = { apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID }
  if (Object.values(options).some(value => !value)) throw new Error('Firebase configuration is missing. Please configure the mobile environment.')
  const app = getApps().length ? getApp() : initializeApp(options)
  const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  // Memory-only Firestore cache: submissions always require a successful online transaction.
  const db = initializeFirestore(app, { experimentalForceLongPolling: true })
  if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1'
    connectAuthEmulator(auth, `http://${host}:${process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || 9099}`, { disableWarnings: true })
    connectFirestoreEmulator(db, host, Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080))
  }
  services = { app, auth, db }; return services
}
