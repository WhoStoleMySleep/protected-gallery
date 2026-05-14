import * as SecureStore from 'expo-secure-store'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToBase64, base64ToBytes } from '../utils/encoding'

const KEY_STORE_KEY = 'vault_master_key_v1'

export const generateAndStoreMasterKey = async (): Promise<Uint8Array> => {
  const keyBytes = new Uint8Array(32)
  crypto.getRandomValues(keyBytes)
  await SecureStore.setItemAsync(KEY_STORE_KEY, bytesToBase64(keyBytes))
  return keyBytes
}

export const loadMasterKey = async (): Promise<Uint8Array | null> => {
  const stored = await SecureStore.getItemAsync(KEY_STORE_KEY)
  if (!stored) return null
  return base64ToBytes(stored)
}

export const masterKeyExists = async (): Promise<boolean> => {
  const stored = await SecureStore.getItemAsync(KEY_STORE_KEY)
  return stored !== null
}

export const deleteMasterKey = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(KEY_STORE_KEY)
}

export const deriveSubKey = (masterKey: Uint8Array, purpose: string): Uint8Array =>
  pbkdf2(sha256, masterKey, `vault:${purpose}:v1`, { c: 10000, dkLen: 32 })
