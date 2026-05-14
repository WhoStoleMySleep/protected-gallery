import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'react-native-quick-crypto'
import { bytesToBase64, base64ToBytes } from '../utils/encoding'

const IV_SIZE = 12
const TAG_SIZE = 16

// AES-256-GCM через нативный C++/JSI — не блокирует JS-поток
export const encryptBytes = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const iv = randomBytes(IV_SIZE) as unknown as Uint8Array
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv) as any
  const encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()])
  const tag = cipher.getAuthTag()
  const result = new Uint8Array(IV_SIZE + encrypted.length + TAG_SIZE)
  result.set(iv, 0)
  result.set(encrypted, IV_SIZE)
  result.set(tag, IV_SIZE + encrypted.length)
  return result
}

export const decryptBytes = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const iv = data.slice(0, IV_SIZE)
  const tag = data.slice(data.length - TAG_SIZE)
  const ciphertext = data.slice(IV_SIZE, data.length - TAG_SIZE)
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv)) as any
  decipher.setAuthTag(Buffer.from(tag))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()])
  return new Uint8Array(decrypted)
}

export const encryptString = (text: string, key: Uint8Array): string =>
  bytesToBase64(encryptBytes(new TextEncoder().encode(text), key))

export const decryptString = (b64: string, key: Uint8Array): string =>
  new TextDecoder().decode(decryptBytes(base64ToBytes(b64), key))
