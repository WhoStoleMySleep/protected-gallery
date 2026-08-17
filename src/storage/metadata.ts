import AsyncStorage from '@react-native-async-storage/async-storage'
import { encryptString, decryptString } from '../crypto/cipher'
import { getDb, getFlag, setFlag } from './db'
import type { VaultFile, FileStatus } from '../types'

let _key: Uint8Array | null = null
let _ns = 'vault'

const key = () => {
  if (!_key) throw new Error('Metadata store not initialized')
  return _key
}

const enc = (value: string) => encryptString(value, key())
const dec = (value: string) => decryptString(value, key())

interface FileRow {
  payload: string
}

const parseRow = (row: FileRow, metaKey: Uint8Array): VaultFile | null => {
  try { return JSON.parse(decryptString(row.payload, metaKey)) } catch { return null }
}

const columnsOf = (file: VaultFile) => ({
  status: file.status ?? 'active',
  importedAt: file.importedAt ?? 0,
  trashedAt: file.trashedAt ?? null,
})

const upsert = async (file: VaultFile, ns: string, payload: string): Promise<void> => {
  const db = await getDb()
  const { status, importedAt, trashedAt } = columnsOf(file)
  await db.runAsync(
    `INSERT INTO files (id, ns, status, imported_at, trashed_at, payload)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ns, id) DO UPDATE SET
       status = excluded.status,
       imported_at = excluded.imported_at,
       trashed_at = excluded.trashed_at,
       payload = excluded.payload`,
    file.id, ns, status, importedAt, trashedAt, payload,
  )
}

export const saveFile = async (file: VaultFile): Promise<void> =>
  upsert(file, _ns, enc(JSON.stringify(file)))

export const saveFileToNs = async (file: VaultFile, ns: string, metaKey: Uint8Array): Promise<void> =>
  upsert(file, ns, encryptString(JSON.stringify(file), metaKey))

export const getFile = async (id: string): Promise<VaultFile | null> => {
  const db = await getDb()
  const row = await db.getFirstAsync<FileRow>(
    'SELECT payload FROM files WHERE ns = ? AND id = ?',
    _ns, id,
  )
  return row ? parseRow(row, key()) : null
}

export const getAllFileIds = async (): Promise<string[]> => {
  const db = await getDb()
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM files WHERE ns = ? ORDER BY imported_at DESC',
    _ns,
  )
  return rows.map(r => r.id)
}

export const getAllFiles = async (): Promise<VaultFile[]> => {
  const db = await getDb()
  const rows = await db.getAllAsync<FileRow>(
    'SELECT payload FROM files WHERE ns = ? ORDER BY imported_at DESC',
    _ns,
  )
  const metaKey = key()
  return rows.map(r => parseRow(r, metaKey)).filter((f): f is VaultFile => f !== null)
}

export const deleteFileMeta = async (id: string): Promise<void> => {
  const db = await getDb()
  await db.runAsync('DELETE FROM files WHERE ns = ? AND id = ?', _ns, id)
}

export const clearAllMeta = async (): Promise<void> => {
  const db = await getDb()
  await db.runAsync('DELETE FROM files WHERE ns = ?', _ns)
  await db.runAsync('DELETE FROM daily WHERE ns = ?', _ns)
}

export const updateFileMeta = async (id: string, partial: Partial<VaultFile>): Promise<void> => {
  const existing = await getFile(id)
  if (!existing) return
  const updated = { ...existing, ...partial }
  await upsert(updated, _ns, enc(JSON.stringify(updated)))
}

/** Отбор идёт по индексу, без расшифровки всего сейфа. */
export const getActiveFileIds = async (): Promise<string[]> => {
  const db = await getDb()
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM files WHERE ns = ? AND status = 'active' ORDER BY imported_at DESC`,
    _ns,
  )
  return rows.map(r => r.id)
}

export const getFilesByStatus = async (status: FileStatus): Promise<VaultFile[]> => {
  const db = await getDb()
  const rows = await db.getAllAsync<FileRow>(
    'SELECT payload FROM files WHERE ns = ? AND status = ? ORDER BY imported_at DESC',
    _ns, status,
  )
  const metaKey = key()
  return rows.map(r => parseRow(r, metaKey)).filter((f): f is VaultFile => f !== null)
}

export const saveDailySelection = async (date: string, ids: string[]): Promise<void> => {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO daily (ns, date, payload) VALUES (?, ?, ?)
     ON CONFLICT(ns, date) DO UPDATE SET payload = excluded.payload`,
    _ns, date, enc(JSON.stringify(ids)),
  )
}

export const loadDailySelection = async (date: string): Promise<string[] | null> => {
  const db = await getDb()
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM daily WHERE ns = ? AND date = ?',
    _ns, date,
  )
  if (!row) return null
  try { return JSON.parse(dec(row.payload)) } catch { return null }
}

/** Все записи пространства имён вместе с зашифрованным телом — для бэкапа. */
export const getRawEntries = async (ns: string): Promise<Record<string, string>> => {
  const db = await getDb()
  const files = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM files WHERE ns = ?', ns,
  )
  const daily = await db.getAllAsync<{ date: string; payload: string }>(
    'SELECT date, payload FROM daily WHERE ns = ?', ns,
  )
  const out: Record<string, string> = {}
  for (const f of files) out[`${ns}:file:${f.id}`] = f.payload
  for (const d of daily) out[`${ns}:daily:${d.date}`] = d.payload
  return out
}

export const putRawEntry = async (
  storageKey: string,
  payload: string,
  metaKey: Uint8Array,
): Promise<boolean> => {
  const fileMatch = storageKey.match(/^(.+):file:(.+)$/)
  if (fileMatch) {
    const [, ns] = fileMatch
    const file = (() => {
      try { return JSON.parse(decryptString(payload, metaKey)) as VaultFile } catch { return null }
    })()
    if (!file) return false
    await upsert(file, ns, payload)
    return true
  }

  const dailyMatch = storageKey.match(/^(.+):daily:(.+)$/)
  if (dailyMatch) {
    const [, ns, date] = dailyMatch
    const db = await getDb()
    await db.runAsync(
      `INSERT INTO daily (ns, date, payload) VALUES (?, ?, ?)
       ON CONFLICT(ns, date) DO UPDATE SET payload = excluded.payload`,
      ns, date, payload,
    )
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Миграция с AsyncStorage
// ---------------------------------------------------------------------------

const MIGRATED_FLAG = (ns: string) => `migrated:asyncstorage:${ns}`
const LEGACY_DECRYPTED_CACHE = 'vault:decryptedUris:v1'

export interface MigrationResult {
  migrated: number
  failed: number
  recovered: number
}

/**
 * Переносит метаданные из AsyncStorage в SQLite.
 *
 * Записи берутся по ключам `<ns>:file:*`, а не по старому массиву-индексу
 * `<ns>:index:v1`. Если запись индекса не пережила переполнение базы, файл
 * оставался на диске, но пропадал из приложения — обход по ключам такие
 * файлы возвращает.
 */
export const migrateFromAsyncStorage = async (
  ns: string,
  metaKey: Uint8Array,
): Promise<MigrationResult> => {
  const result: MigrationResult = { migrated: 0, failed: 0, recovered: 0 }
  if (await getFlag(MIGRATED_FLAG(ns))) return result

  const allKeys = (await AsyncStorage.getAllKeys()) as string[]
  const filePrefix = `${ns}:file:`
  const dailyPrefix = `${ns}:daily:`
  const indexKey = `${ns}:index:v1`

  const dataKeys = allKeys.filter(k => k.startsWith(filePrefix) || k.startsWith(dailyPrefix))
  if (dataKeys.length === 0) {
    await setFlag(MIGRATED_FLAG(ns), String(Date.now()))
    return result
  }

  const indexedIds = await (async () => {
    try {
      const raw = await AsyncStorage.getItem(indexKey)
      return new Set<string>(raw ? JSON.parse(raw) : [])
    } catch { return new Set<string>() }
  })()

  const db = await getDb()
  const BATCH = 200

  for (let i = 0; i < dataKeys.length; i += BATCH) {
    const chunk = dataKeys.slice(i, i + BATCH)
    const pairs = await AsyncStorage.multiGet(chunk)

    await db.withTransactionAsync(async () => {
      for (const [storageKey, payload] of pairs) {
        if (payload === null) continue
        const ok = await putRawEntry(storageKey, payload, metaKey)
        if (ok) {
          result.migrated++
          if (storageKey.startsWith(filePrefix) && !indexedIds.has(storageKey.slice(filePrefix.length)))
            result.recovered++
        } else {
          result.failed++
        }
      }
    })
  }

  // Старые записи намеренно НЕ удаляются: лимит базы поднят, места они не
  // отнимают, а до тех пор, пока перенос не проверен на реальном сейфе, это
  // единственная запасная копия метаданных. Удаление — отдельным действием,
  // см. purgeLegacyAsyncStorage.
  //
  // Исключение — кэш расшифрованных путей: это эфемерные ссылки на временные
  // файлы, ценности они не представляют и больше не используются.
  try { await AsyncStorage.removeItem(LEGACY_DECRYPTED_CACHE) } catch {}

  if (result.failed === 0) await setFlag(MIGRATED_FLAG(ns), String(Date.now()))

  return result
}

/**
 * Убирает перенесённые метаданные из AsyncStorage. Вызывать только после того,
 * как сейф открыт и файлы на месте, — до этого старая копия остаётся
 * страховкой на случай неудачной миграции.
 */
export const purgeLegacyAsyncStorage = async (ns: string): Promise<number> => {
  if (!(await getFlag(MIGRATED_FLAG(ns)))) return 0

  const allKeys = (await AsyncStorage.getAllKeys()) as string[]
  const stale = allKeys.filter(
    k => k.startsWith(`${ns}:file:`) || k.startsWith(`${ns}:daily:`) || k === `${ns}:index:v1`,
  )

  const BATCH = 200
  for (let i = 0; i < stale.length; i += BATCH) {
    try { await AsyncStorage.multiRemove(stale.slice(i, i + BATCH)) } catch {}
  }
  return stale.length
}

export const initMetadataStore = async (
  key: Uint8Array,
  namespace = 'vault',
): Promise<MigrationResult> => {
  _key = key
  _ns = namespace
  await getDb()
  return migrateFromAsyncStorage(namespace, key)
}
