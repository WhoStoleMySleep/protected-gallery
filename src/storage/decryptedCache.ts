import { File, Directory, Paths } from 'expo-file-system'
import { getExtension } from '../utils/media'

/**
 * Кэш расшифрованных временных файлов.
 *
 * Раньше карта fileId → uri хранилась в AsyncStorage одним JSON-блобом и
 * перезаписывалась целиком при каждом просмотре. На больших сейфах это
 * переполняло базу AsyncStorage (SQLITE_FULL) и ломало сам просмотр.
 *
 * Имя временного файла детерминировано (`tmp_<cacheKey>.<ext>`), поэтому
 * персистентное хранилище не нужно: наличие кэша проверяется по файловой
 * системе, а память используется только как быстрый путь.
 */

const TEMP_PREFIX = 'tmp_'

const mem = new Map<string, string>()

const getCacheDir = () => new Directory(Paths.cache)

export const tempFileName = (cacheKey: string, mimeType: string): string =>
  `${TEMP_PREFIX}${cacheKey}.${getExtension(mimeType)}`

export const getDecryptedUri = (cacheKey: string, mimeType: string): string | null => {
  const cached = mem.get(cacheKey)
  if (cached) {
    try {
      if (new File(cached).exists) return cached
    } catch {}
    mem.delete(cacheKey)
  }

  try {
    const file = new File(getCacheDir(), tempFileName(cacheKey, mimeType))
    if (file.exists) {
      mem.set(cacheKey, file.uri)
      return file.uri
    }
  } catch {}

  return null
}

export const setDecryptedUri = (cacheKey: string, uri: string): void => {
  mem.set(cacheKey, uri)
}

/**
 * Удаляет расшифрованные копии. Раньше временные файлы оставались в кэше
 * после безвозвратного удаления — открытый плейнтекст переживал удаление
 * самой записи.
 */
export const removeDecryptedUris = (fileIds: string[]): void => {
  const prefixes = fileIds.flatMap(id => [
    `${TEMP_PREFIX}${id}.`,
    `${TEMP_PREFIX}${id}_thumb.`,
  ])

  fileIds.forEach(id => { mem.delete(id); mem.delete(`${id}_thumb`) })

  try {
    for (const item of getCacheDir().list()) {
      if (item instanceof File && prefixes.some(p => item.name.startsWith(p))) {
        try { item.delete() } catch {}
      }
    }
  } catch {}
}

export const resetDecryptedCacheMem = (): void => { mem.clear() }

export const clearDecryptedCache = (): void => {
  mem.clear()
  try {
    for (const item of getCacheDir().list()) {
      if (item instanceof File && item.name.startsWith(TEMP_PREFIX)) {
        try { item.delete() } catch {}
      }
    }
  } catch {}
}
