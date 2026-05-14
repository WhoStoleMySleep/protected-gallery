import * as SecureStore from 'expo-secure-store'
import { pbkdf2 } from 'react-native-quick-crypto'
import { bytesToHex, textToBytes } from '../utils/encoding'

const PIN_STORE_KEY = 'vault_pin_hash_v1'
const PIN_SALT = 'vault:pin:salt:v1'

// PBKDF2 через нативный C++ — неблокирующий async
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
  const stored = await SecureStore.getItemAsync(PIN_STORE_KEY)
  return stored !== null
}

export const deletePin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PIN_STORE_KEY)
}
