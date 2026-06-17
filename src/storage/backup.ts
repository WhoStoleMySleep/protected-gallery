import { File, Directory, Paths } from 'expo-file-system'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { pbkdf2, randomBytes } from 'react-native-quick-crypto'
import { zip, unzip } from 'react-native-zip-archive'
import { encryptBytes, decryptBytes, encryptString, decryptString } from '../crypto/cipher'
import { bytesToBase64, base64ToBytes } from '../utils/encoding'
import { deriveSubKey } from '../crypto/keys'
import { getAllFiles, clearAllMeta } from './metadata'
import { clearVault } from './vault'
import type { VaultFile } from '../types'

const MASTER_KEY_STORE = 'vault_master_key_v1'
const PIN_STORE_KEY = 'vault_pin_hash_v1'
const VAULT_NS = 'vault'
const MANIFEST_FILE = 'manifest.json'

interface BackupManifest {
  version: number
  createdAt: number
  salt: string
  encMasterKey: string
  asyncData: Record<string, string>
}

const deriveBackupKey = (password: string, salt: Uint8Array): Promise<Uint8Array> =>
  new Promise((resolve, reject) =>
    pbkdf2(Buffer.from(password, 'utf8'), Buffer.from(salt), 200000, 32, 'sha256', (err, key) => {
      if (err || !key) return reject(err ?? new Error('PBKDF2 failed'))
      resolve(new Uint8Array(key as unknown as Uint8Array))
    })
  )

const toPath = (uri: string): string => uri.replace(/^file:\/\//, '')

const collectAsyncData = async (): Promise<Record<string, string>> => {
  const allKeys = await AsyncStorage.getAllKeys()
  const vaultKeys = (allKeys as string[]).filter(k => k.startsWith(`${VAULT_NS}:`))
  const pairs = await AsyncStorage.multiGet(vaultKeys)
  const result: Record<string, string> = {}
  for (const [k, v] of pairs) { if (v !== null) result[k] = v }
  return result
}

export const exportBackup = async (password: string, masterKey: Uint8Array): Promise<string> => {
  const salt = new Uint8Array(randomBytes(16) as unknown as Uint8Array)
  const backupKey = await deriveBackupKey(password, salt)
  const manifest: BackupManifest = {
    version: 1,
    createdAt: Date.now(),
    salt: bytesToBase64(salt),
    encMasterKey: bytesToBase64(encryptBytes(masterKey, backupKey)),
    asyncData: await collectAsyncData(),
  }

  const tempDir = new Directory(Paths.cache, `backup_${Date.now()}`)
  tempDir.create({ intermediates: true })

  try {
    new File(tempDir, MANIFEST_FILE).write(JSON.stringify(manifest))

    const vaultFiles = await getAllFiles()
    for (const f of vaultFiles) {
      const encFile = new File(f.encryptedPath)
      if (encFile.exists) encFile.copy(tempDir)

      if (f.thumbPath) {
        const thumb = new File(f.thumbPath)
        if (thumb.exists) thumb.copy(tempDir)
      }
    }

    const outFile = new File(Paths.cache, `vault_backup_${Date.now()}.pgbak`)
    await zip(toPath(tempDir.uri), toPath(outFile.uri))
    return outFile.uri
  } finally {
    if (tempDir.exists) tempDir.delete()
  }
}

const fixFileMeta = (encVal: string, metaKey: Uint8Array, vaultDir: Directory): string => {
  const meta: VaultFile = JSON.parse(decryptString(encVal, metaKey))
  meta.encryptedPath = new File(vaultDir, `${meta.id}.enc`).uri
  if (meta.thumbPath) {
    const thumbFile = new File(vaultDir, `${meta.id}_thumb.enc`)
    meta.thumbPath = thumbFile.exists ? thumbFile.uri : undefined
  }
  return encryptString(JSON.stringify(meta), metaKey)
}

const fixAndRestoreMetadata = async (
  asyncData: Record<string, string>,
  metaKey: Uint8Array,
  vaultDir: Directory,
): Promise<void> => {
  for (const [k, v] of Object.entries(asyncData)) {
    if (k.startsWith(`${VAULT_NS}:file:`)) {
      try {
        await AsyncStorage.setItem(k, fixFileMeta(v, metaKey, vaultDir))
      } catch {
        await AsyncStorage.setItem(k, v)
      }
    } else {
      await AsyncStorage.setItem(k, v)
    }
  }
}

export const importBackup = async (fileUri: string, password: string): Promise<void> => {
  const tempDir = new Directory(Paths.cache, `restore_${Date.now()}`)

  try {
    await unzip(toPath(fileUri), toPath(tempDir.uri))

    const manifest: BackupManifest = JSON.parse(
      await new File(tempDir, MANIFEST_FILE).text()
    )

    const backupKey = await deriveBackupKey(password, base64ToBytes(manifest.salt))
    let masterKey: Uint8Array
    try {
      masterKey = decryptBytes(base64ToBytes(manifest.encMasterKey), backupKey)
    } catch {
      throw new Error('WRONG_PIN')
    }

    await clearAllMeta()
    clearVault()

    await SecureStore.setItemAsync(MASTER_KEY_STORE, bytesToBase64(masterKey))

    const vaultDir = new Directory(Paths.document, VAULT_NS)
    if (!vaultDir.exists) vaultDir.create({ intermediates: true })

    for (const item of tempDir.list()) {
      if (item instanceof File && item.name.endsWith('.enc'))
        item.copy(vaultDir)
    }

    const metaKey = await deriveSubKey(masterKey, 'metadata')
    await fixAndRestoreMetadata(manifest.asyncData, metaKey, vaultDir)

    await SecureStore.deleteItemAsync(PIN_STORE_KEY)
  } finally {
    if (tempDir.exists) tempDir.delete()
  }
}
