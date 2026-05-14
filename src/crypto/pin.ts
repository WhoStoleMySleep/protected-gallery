import * as SecureStore from 'expo-secure-store'
import { pbkdf2 } from 'react-native-quick-crypto'
import { bytesToHex, textToBytes } from '../utils/encoding'
import type { VaultMode } from '../types'

const PIN_STORE_KEY = 'vault_pin_hash_v1'
const SAFE_PIN_STORE_KEY = 'vault_safe_pin_hash_v1'
const PIN_SALT = 'vault:pin:salt:v1'

const hashPin = (pin: string): Promise<string> =>
  new Promise((resolve, reject) =>
    pbkdf2(pin, PIN_SALT, 100000, 32, 'sha256', (err, key) => {
      if (err || !key) return reject(err)
      resolve(bytesToHex(new Uint8Array(key as unknown as Uint8Array)))
    })
  )

export const setupPin = async (pin: string): Promise<void> => {
  await SecureStore.setItemAsync(PIN_STORE_KEY, await hashPin(pin))
}

export const verifyPin = async (pin: string): Promise<boolean> => {
  const stored = await SecureStore.getItemAsync(PIN_STORE_KEY)
  if (!stored) return false
  return (await hashPin(pin)) === stored
}

export const pinExists = async (): Promise<boolean> => {
  return (await SecureStore.getItemAsync(PIN_STORE_KEY)) !== null
}

export const deletePin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PIN_STORE_KEY)
}

// Safe mode PIN
export const setupSafePin = async (pin: string): Promise<void> => {
  await SecureStore.setItemAsync(SAFE_PIN_STORE_KEY, await hashPin(pin))
}

export const verifySafePin = async (pin: string): Promise<boolean> => {
  const stored = await SecureStore.getItemAsync(SAFE_PIN_STORE_KEY)
  if (!stored) return false
  return (await hashPin(pin)) === stored
}

export const safePinExists = async (): Promise<boolean> => {
  return (await SecureStore.getItemAsync(SAFE_PIN_STORE_KEY)) !== null
}

export const deleteSafePin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(SAFE_PIN_STORE_KEY)
}

// Check both PINs and return which vault to open
export const checkPinMode = async (pin: string): Promise<VaultMode | null> => {
  const hash = await hashPin(pin)
  const realHash = await SecureStore.getItemAsync(PIN_STORE_KEY)
  if (realHash && hash === realHash) return 'real'
  const safeHash = await SecureStore.getItemAsync(SAFE_PIN_STORE_KEY)
  if (safeHash && hash === safeHash) return 'safe'
  return null
}
