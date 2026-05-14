import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity, BackHandler,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { SelectionBar } from '../components/SelectionBar'
import { useSelection } from '../hooks/useSelection'
import { getFilesByStatus, updateFileMeta } from '../storage/metadata'
import type { VaultFile } from '../types'
import { COLORS } from '../theme'

const { width } = Dimensions.get('window')
const COLS = 3
const GAP = 2
const ITEM_SIZE = (width - GAP * (COLS + 1)) / COLS

interface Props {
  fileKey: Uint8Array
  onOpenViewer: (fileIds: string[], index: number) => void
  onBack: () => void
}

export const ArchiveScreen: React.FC<Props> = ({ fileKey, onOpenViewer, onBack }) => {
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { selected, selectionMode, enterSelection, toggleItem, clearSelection } = useSelection()

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true })
    return () => sub.remove()
  }, [onBack])

  const loadArchive = useCallback(async () => {
    const archived = await getFilesByStatus('archived')
    archived.sort((a, b) => b.importedAt - a.importedAt)
    setFiles(archived)
  }, [])

  React.useEffect(() => {
    loadArchive().finally(() => setLoading(false))
  }, [loadArchive])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadArchive()
    setRefreshing(false)
  }

  const restore = async () => {
    await Promise.all(Array.from(selected).map(id => updateFileMeta(id, { status: 'active' })))
    clearSelection()
    await loadArchive()
  }

  const fileIds = files.map(f => f.id)

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Архив</Text>
        {!loading && <Text style={styles.count}>{files.length} файлов</Text>}
        {loading && <View style={styles.backBtn} />}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>
      ) : files.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Архив пуст</Text>
          <Text style={styles.emptyHint}>Заархивированные файлы не попадают в ежедневную подборку</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={f => f.id}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
          renderItem={({ item, index }) => (
            <View style={{ margin: GAP / 2 }}>
              <MediaThumbnail
                file={item}
                fileKey={fileKey}
                size={ITEM_SIZE}
                selectionMode={selectionMode}
                selected={selected.has(item.id)}
                onPress={() => selectionMode ? toggleItem(item.id) : onOpenViewer(fileIds, index)}
                onLongPress={() => !selectionMode && enterSelection(item.id)}
              />
            </View>
          )}
        />
      )}

      {selectionMode && (
        <SelectionBar
          count={selected.size}
          onCancel={clearSelection}
          actions={[
            { label: 'Восстановить', onPress: restore },
          ]}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { minWidth: 64 },
  backTxt: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  count: { fontSize: 13, color: COLORS.subtext, minWidth: 64, textAlign: 'right' },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', lineHeight: 20 },
})
