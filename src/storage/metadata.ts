import AsyncStorage from '@react-native-async-storage/async-storage'
import { encryptString, decryptString } from '../crypto/cipher'
import type { VaultFile, FileStatus } from '../types'

let _key: Uint8Array | null = null

export const initMetadataStore = (key: Uint8Array) => { _key = key }

const key = () => {
  if (!_key) throw new Error('Metadata store not initialized')
  return _key
}

const KEYS_INDEX = 'vault:index:v1'
const FILE_PREFIX = 'vault:file:'
const DAILY_PREFIX = 'vault:daily:'

const enc = (value: string) => encryptString(value, key())
const dec = (value: string) => decryptString(value, key())

export const saveFile = async (file: VaultFile): Promise<void> => {
  await AsyncStorage.setItem(FILE_PREFIX + file.id, enc(JSON.stringify(file)))
  const raw = await AsyncStorage.getItem(KEYS_INDEX)
  const ids: string[] = raw ? JSON.parse(raw) : []
  if (!ids.includes(file.id)) {
    ids.push(file.id)
    await AsyncStorage.setItem(KEYS_INDEX, JSON.stringify(ids))
  }
}

export const getFile = async (id: string): Promise<VaultFile | null> => {
  const raw = await AsyncStorage.getItem(FILE_PREFIX + id)
  if (!raw) return null
  try {
    return JSON.parse(dec(raw))
  } catch {
    return null
  }
}

export const getAllFileIds = async (): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(KEYS_INDEX)
  return raw ? JSON.parse(raw) : []
}

export const getAllFiles = async (): Promise<VaultFile[]> => {
  const ids = await getAllFileIds()
  const files = await Promise.all(ids.map(id => getFile(id)))
  return files.filter((f): f is VaultFile => f !== null)
}

export const deleteFileMeta = async (id: string): Promise<void> => {
  await AsyncStorage.removeItem(FILE_PREFIX + id)
  const raw = await AsyncStorage.getItem(KEYS_INDEX)
  const ids: string[] = raw ? JSON.parse(raw) : []
  await AsyncStorage.setItem(KEYS_INDEX, JSON.stringify(ids.filter(k => k !== id)))
}

export const clearAllMeta = async (): Promise<void> => {
  const ids = await getAllFileIds()
  await Promise.all(ids.map(id => AsyncStorage.removeItem(FILE_PREFIX + id)))
  await AsyncStorage.removeItem(KEYS_INDEX)
}

export const updateFileMeta = async (id: string, partial: Partial<VaultFile>): Promise<void> => {
  const existing = await getFile(id)
  if (!existing) return
  await AsyncStorage.setItem(FILE_PREFIX + id, enc(JSON.stringify({ ...existing, ...partial })))
}

export const getActiveFileIds = async (): Promise<string[]> => {
  const ids = await getAllFileIds()
  const files = await Promise.all(ids.map(id => getFile(id)))
  return files
    .filter((f): f is VaultFile => f !== null && (!f.status || f.status === 'active'))
    .map(f => f.id)
}

export const getFilesByStatus = async (status: FileStatus): Promise<VaultFile[]> => {
  const ids = await getAllFileIds()
  const files = await Promise.all(ids.map(id => getFile(id)))
  return files.filter((f): f is VaultFile => f !== null && f.status === status)
}

export const saveDailySelection = async (date: string, ids: string[]): Promise<void> => {
  await AsyncStorage.setItem(DAILY_PREFIX + date, enc(JSON.stringify(ids)))
}

export const loadDailySelection = async (date: string): Promise<string[] | null> => {
  const raw = await AsyncStorage.getItem(DAILY_PREFIX + date)
  if (!raw) return null
  try {
    return JSON.parse(dec(raw))
  } catch {
    return null
  }
}
