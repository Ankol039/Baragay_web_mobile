import * as Crypto from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { request } from './transport.js'
import { login } from './authService.js'
export const registrationMetadata = () => request('accounts.php', { action: 'registrationFields' }, false)
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
export async function registerResident(values, operationId) {
  // Retry after an app restart by refilling the same values. Persist only an opaque
  // UUID keyed by a digest; never persist submitted profiles or passwords.
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(canonical(values)))
  let attempts
  try { attempts = JSON.parse(await AsyncStorage.getItem('registrationAttempts') || '{}') } catch { attempts = {} }
  operationId = attempts[hash] || operationId || newOperationId()
  attempts[hash] = operationId
  await AsyncStorage.setItem('registrationAttempts', JSON.stringify(Object.fromEntries(Object.entries(attempts).slice(-20))))
  return request('accounts.php', { action: 'registerResident', operationId, values }, false)
}
export const newOperationId = () => Crypto.randomUUID()
export const signInRegistered = (number, password) => login({ identifier: number, password })
