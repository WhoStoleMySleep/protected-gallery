import { loadSafeKey, deriveSubKey } from '../crypto/keys'
import { getFile, saveFileToNs } from './metadata'
import { transferFileToSafe, permanentlyDeleteFiles } from './vault'

/** Returns number of moved files, or -1 if safe mode is not configured. */
export const moveFilesToSafe = async (
  ids: string[],
  realKey: Uint8Array,
): Promise<number> => {
  const safeKey = await loadSafeKey()
  if (!safeKey) return -1

  const safeMetaKey = await deriveSubKey(safeKey, 'metadata')
  let moved = 0
  const toDelete = []

  for (const id of ids) {
    const file = await getFile(id)
    if (!file) continue
    try {
      const newFile = await transferFileToSafe(file, realKey, safeKey)
      await saveFileToNs(newFile, 'vault_safe', safeMetaKey)
      toDelete.push(file)
      moved++
    } catch {}
  }

  if (toDelete.length > 0) await permanentlyDeleteFiles(toDelete)
  return moved
}
