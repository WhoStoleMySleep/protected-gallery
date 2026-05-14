import * as SecureStore from 'expo-secure-store'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, textToBytes } from '../utils/encoding'

const PIN_STORE_KEY = 'vault_pin_hash_v1'
const PIN_SALT = textToBytes('vault:pin:salt:v1')

const hashPin = (pin: string): string => {
  const hash = pbkdf2(sha256, textToBytes(pin), PIN_SALT, { c: 100000, dkLen: 32 })
  return bytesToHex(hash)
}

export const setupPin = async (pin: string): Promise<void> => {
  await SecureStore.setItemAsync(PIN_STORE_KEY, hashPin(pin))
}

export const verifyPin = async (pin: string): Promise<boolean> => {
  const stored = await SecureStore.getItemAsync(PIN_STORE_KEY)
  if (!stored) return false
  return hashPin(pin) === stored
}

export const pinExists = async (): Promise<boolean> => {
  const stored = await SecureStore.getItemAsync(PIN_STORE_KEY)
  return stored !== null
}

export const deletePin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PIN_STORE_KEY)
}
