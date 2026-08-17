import * as SQLite from 'expo-sqlite'

/**
 * Собственная база метаданных.
 *
 * AsyncStorage не подходит как хранилище на тысячи записей: на Android это
 * SQLite с лимитом в несколько мегабайт, общий на всё приложение, а индекс
 * файлов там приходилось держать одним массивом и перезаписывать целиком
 * при каждом сохранении.
 *
 * Здесь тело записи остаётся зашифрованным (колонка payload), а в открытом
 * виде лежат только status/imported_at — они нужны для индексов, чтобы
 * выборки не читали и не расшифровывали весь сейф целиком.
 */

const DB_NAME = 'vault-meta.db'

let _db: SQLite.SQLiteDatabase | null = null

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (_db) return _db

  const db = await SQLite.openDatabaseAsync(DB_NAME)
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS files (
      id          TEXT NOT NULL,
      ns          TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active',
      imported_at INTEGER NOT NULL DEFAULT 0,
      trashed_at  INTEGER,
      payload     TEXT NOT NULL,
      PRIMARY KEY (ns, id)
    );

    CREATE INDEX IF NOT EXISTS idx_files_ns_status
      ON files (ns, status, imported_at DESC);

    CREATE TABLE IF NOT EXISTS daily (
      ns      TEXT NOT NULL,
      date    TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (ns, date)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `)

  _db = db
  return db
}

export const getFlag = async (key: string): Promise<string | null> => {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    key,
  )
  return row?.value ?? null
}

export const setFlag = async (key: string, value: string): Promise<void> => {
  const db = await getDb()
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  )
}

export const closeDb = async (): Promise<void> => {
  if (!_db) return
  await _db.closeAsync()
  _db = null
}
