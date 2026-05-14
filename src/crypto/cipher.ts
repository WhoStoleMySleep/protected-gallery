import { gcm } from '@noble/ciphers/aes.js'
import { bytesToBase64, base64ToBytes } from '../utils/encoding'

const IV_SIZE = 12

export const encryptBytes = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const iv = new Uint8Array(IV_SIZE)
  crypto.getRandomValues(iv)
  const cipher = gcm(key, iv)
  const ciphertext = cipher.encrypt(data)
  const result = new Uint8Array(IV_SIZE + ciphertext.length)
  result.set(iv, 0)
  result.set(ciphertext, IV_SIZE)
  return result
}

export const decryptBytes = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const iv = data.slice(0, IV_SIZE)
  const ciphertext = data.slice(IV_SIZE)
  const cipher = gcm(key, iv)
  return cipher.decrypt(ciphertext)
}

export const encryptString = (text: string, key: Uint8Array): string => {
  const encoded = new TextEncoder().encode(text)
  return bytesToBase64(encryptBytes(encoded, key))
}

export const decryptString = (b64: string, key: Uint8Array): string => {
  const bytes = base64ToBytes(b64)
  const decrypted = decryptBytes(bytes, key)
  return new TextDecoder().decode(decrypted)
}
