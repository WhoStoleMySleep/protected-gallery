import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity, BackHandler,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { SelectionBar } from '../components/SelectionBar'
import { useSelection } from '../hooks/useSelection'
import { getAllFileIds, getFile, updateFileMeta } from '../storage/metadata'
import type { VaultFile } from '../types'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

const { width } = Dimensions.get('window')
const COLS = 3
const GAP = 2
const ITEM_SIZE = (width - GAP * (COLS + 1)) / COLS

interface Props {
  fileKey: Uint8Array
  onOpenViewer: (fileIds: string[], index: number) => void
  onBack: () => void
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { minWidth: 64 },
  backTxt: { color: c.accent, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  count: { fontSize: 13, color: c.subtext, minWidth: 64, textAlign: 'right' },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: c.subtext, textAlign: 'center', lineHeight: 20 },
})

export const AllMediaScreen: React.FC<Props> = ({ fileKey, onOpenViewer, onBack }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { selected, selectionMode, enterSelection, toggleItem, clearSelection } = useSelection()

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true })
    return () => sub.remove()
  }, [onBack])

  const loadAll = useCallback(async () => {
    setLoadError(null)
    try {
      const allIds = await getAllFileIds()
      const loaded = await Promise.all(allIds.map(id => getFile(id)))
      const valid = loaded.filter((f): f is VaultFile => f !== null && (!f.status || f.status === 'active'))
      valid.sort((a, b) => b.importedAt - a.importedAt)
      setFiles(valid)
    } catch (e: any) {
      setLoadError(e?.message ?? String(e))
    }
  }, [])

  React.useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [loadAll])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  const archiveSelected = async () => {
    await Promise.all(Array.from(selected).map(id => updateFileMeta(id, { status: 'archived' })))
    clearSelection()
    await loadAll()
  }

  const trashSelected = async () => {
    const now = Date.now()
    await Promise.all(Array.from(selected).map(id => updateFileMeta(id, { status: 'trashed', trashedAt: now })))
    clearSelection()
    await loadAll()
  }

  const fileIds = files.map(f => f.id)

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Все медиа</Text>
        {!loading && <Text style={styles.count}>{files.length} файлов</Text>}
        {loading && <View style={styles.backBtn} />}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 }}>
            Ошибка загрузки:{'\n'}{loadError}
          </Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyText}>Сейф пуст</Text>
          <Text style={styles.emptyHint}>Перейдите на вкладку «Импорт», чтобы добавить медиафайлы</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={f => f.id}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
            { label: 'Архив', onPress: archiveSelected },
            { label: 'Корзина', danger: true, onPress: trashSelected },
          ]}
        />
      )}
    </SafeAreaView>
  )
}
