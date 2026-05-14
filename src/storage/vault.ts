import { File, Directory, Paths } from 'expo-file-system'
import * as ImageManipulator from 'expo-image-manipulator'
import { encryptBytes, decryptBytes } from '../crypto/cipher'
import { getExtension, getMediaKind } from '../utils/media'
import { getDecryptedUri, setDecryptedUri, removeDecryptedUris } from './decryptedCache'
import { deleteFileMeta, getFilesByStatus } from './metadata'
import type { VaultFile } from '../types'

const yield_ = () => new Promise<void>(r => setTimeout(r, 0))

let _vaultNs = 'vault'
export const initVaultNamespace = (namespace: string) => { _vaultNs = namespace }

const getVaultDir = () => new Directory(Paths.document, _vaultNs)
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
  const fileBytes = await new File(sourceUri).bytes()
  await yield_()
  const encrypted = encryptBytes(fileBytes, key)
  await yield_()
  const encFile = new File(getVaultDir(), `${fileId}.enc`)
  encFile.write(encrypted)
  return encFile.uri
}

export const generateAndEncryptThumb = async (
  sourceUri: string,
  fileId: string,
  mimeType: string,
  key: Uint8Array,
): Promise<string | null> => {
  const kind = getMediaKind(mimeType)
  if (kind !== 'image' && kind !== 'gif') return null
  try {
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 300 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    )
    const thumbBytes = await new File(result.uri).bytes()
    await yield_()
    const encrypted = encryptBytes(thumbBytes, key)
    await yield_()
    const encThumb = new File(getVaultDir(), `${fileId}_thumb.enc`)
    encThumb.write(encrypted)
    try { new File(result.uri).delete() } catch {}
    return encThumb.uri
  } catch (e) {
    console.warn('Thumb generation failed:', e)
    return null
  }
}

export const decryptToTemp = async (
  encUri: string,
  key: Uint8Array,
  mimeType: string,
  fileId?: string,
): Promise<string> => {
  if (fileId) {
    const cached = await getDecryptedUri(fileId)
    if (cached) return cached
  }
  const encBytes = await new File(encUri).bytes()
  await yield_()
  const decrypted = decryptBytes(encBytes, key)
  await yield_()
  const ext = getExtension(mimeType)
  const tempFile = new File(getCacheDir(), `tmp_${fileId ?? Date.now()}.${ext}`)
  tempFile.write(decrypted)
  if (fileId) await setDecryptedUri(fileId, tempFile.uri)
  return tempFile.uri
}

export const deleteEncFile = (encUri: string) => {
  const file = new File(encUri)
  if (file.exists) file.delete()
}

export const permanentlyDeleteFiles = async (files: VaultFile[]): Promise<void> => {
  await removeDecryptedUris(files.map(f => f.id))
  await Promise.all(files.map(async f => {
    deleteEncFile(f.encryptedPath)
    if (f.thumbPath) deleteEncFile(f.thumbPath)
    await deleteFileMeta(f.id)
  }))
}

export const purgeExpiredTrash = async (): Promise<void> => {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const trashed = await getFilesByStatus('trashed')
  const expired = trashed.filter(f => f.trashedAt && now - f.trashedAt > THIRTY_DAYS)
  if (expired.length > 0) await permanentlyDeleteFiles(expired)
}

export const clearVault = () => {
  const dir = getVaultDir()
  if (dir.exists) dir.delete()
}
