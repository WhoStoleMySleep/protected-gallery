import { File, Directory, Paths } from 'expo-file-system'
import { encryptBytes, decryptBytes } from '../crypto/cipher'
import { bytesToBase64, base64ToBytes } from '../utils/encoding'
import { getExtension } from '../utils/media'

const getVaultDir = () => new Directory(Paths.document, 'vault')
const getCacheDir = () => new Directory(Paths.cache)

export const ensureVaultDir = () => {
  const dir = getVaultDir()
  if (!dir.exists) dir.create({ intermediates: true })
}

export const encryptAndSave = async (
  sourceUri: string,
  fileId: string,
  key: Uint8Array,
): Promise<string> => {
  ensureVaultDir()
  const sourceFile = new File(sourceUri)
  const fileBytes = await sourceFile.bytes()
  const encrypted = encryptBytes(fileBytes, key)
  const encFile = new File(getVaultDir(), `${fileId}.enc`)
  encFile.write(bytesToBase64(encrypted), { encoding: 'base64' })
  return encFile.uri
}

export const decryptToTemp = async (
  encUri: string,
  key: Uint8Array,
  mimeType: string,
): Promise<string> => {
  const encFile = new File(encUri)
  const encB64 = await encFile.base64()
  const encBytes = base64ToBytes(encB64)
  const decrypted = decryptBytes(encBytes, key)
  const ext = getExtension(mimeType)
  const tempFile = new File(getCacheDir(), `tmp_${Date.now()}.${ext}`)
  tempFile.write(bytesToBase64(decrypted), { encoding: 'base64' })
  return tempFile.uri
}

export const deleteEncFile = (encUri: string) => {
  const file = new File(encUri)
  if (file.exists) file.delete()
}

export const clearVault = () => {
  const dir = getVaultDir()
  if (dir.exists) dir.delete()
}
