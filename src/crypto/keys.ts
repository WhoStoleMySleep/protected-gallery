import * as SecureStore from 'expo-secure-store'
import { randomBytes, pbkdf2 } from 'react-native-quick-crypto'
import { bytesToBase64, base64ToBytes } from '../utils/encoding'

const KEY_STORE_KEY = 'vault_master_key_v1'

export const generateAndStoreMasterKey = async (): Promise<Uint8Array> => {
  const keyBytes = new Uint8Array(randomBytes(32) as unknown as Uint8Array)
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

export const deriveSubKey = (masterKey: Uint8Array, purpose: string): Promise<Uint8Array> =>
  new Promise((resolve, reject) =>
    pbkdf2(Buffer.from(masterKey), `vault:${purpose}:v1`, 10000, 32, 'sha256', (err, key) => {
      if (err || !key) return reject(err)
      resolve(new Uint8Array(key as unknown as Uint8Array))
    })
  )
