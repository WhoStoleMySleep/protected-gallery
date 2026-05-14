import AsyncStorage from '@react-native-async-storage/async-storage'
import { File } from 'expo-file-system'

const STORE_KEY = 'vault:decryptedUris:v1'

let mem: Record<string, string> | null = null

const load = async (): Promise<Record<string, string>> => {
  if (mem) return mem
  const raw = await AsyncStorage.getItem(STORE_KEY)
  mem = raw ? JSON.parse(raw) : {}
  return mem!
}

export const getDecryptedUri = async (fileId: string): Promise<string | null> => {
  const cache = await load()
  const uri = cache[fileId]
  if (!uri) return null
  try {
    if (new File(uri).exists) return uri
  } catch {}
  // файл удалён системой — убираем из кэша
  delete cache[fileId]
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(cache))
  return null
}

export const setDecryptedUri = async (fileId: string, uri: string): Promise<void> => {
  const cache = await load()
  cache[fileId] = uri
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(cache))
}

export const removeDecryptedUris = async (fileIds: string[]): Promise<void> => {
  const cache = await load()
  fileIds.forEach(id => { delete cache[id]; delete cache[id + '_thumb'] })
  mem = cache
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(cache))
}

export const clearDecryptedCache = async (): Promise<void> => {
  mem = {}
  await AsyncStorage.removeItem(STORE_KEY)
}
