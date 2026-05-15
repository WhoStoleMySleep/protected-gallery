import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity, BackHandler, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { SelectionBar } from '../components/SelectionBar'
import { useSelection } from '../hooks/useSelection'
import { getAllFileIds, getFile, updateFileMeta } from '../storage/metadata'
import { getMediaKind } from '../utils/media'
import type { VaultFile } from '../types'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

const { width } = Dimensions.get('window')
const COLS = 3
const GAP = 2
const ITEM_SIZE = (width - GAP * (COLS + 1)) / COLS

type FilterType = 'all' | 'image' | 'video' | 'gif'
type SortType = 'date_desc' | 'date_asc' | 'size_desc'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'image', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'gif', label: 'GIF' },
]

const SORT_OPTIONS: { key: SortType; label: string; icon: 'arrow-down' | 'arrow-up' | 'resize' }[] = [
  { key: 'date_desc', label: 'Новые', icon: 'arrow-down' },
  { key: 'date_asc', label: 'Старые', icon: 'arrow-up' },
  { key: 'size_desc', label: 'Размер', icon: 'resize' },
]

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
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: { minWidth: 64 },
  backTxt: { color: c.accent, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  count: { fontSize: 13, color: c.subtext, minWidth: 64, textAlign: 'right' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 8, gap: 8,
  },
  filterRow: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipTxt: { color: c.subtext, fontSize: 13, fontWeight: '600' },
  chipTxtActive: { color: '#fff' },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  sortTxt: { color: c.subtext, fontSize: 13, fontWeight: '600' },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, marginTop: 16 },
  emptyHint: { fontSize: 14, color: c.subtext, textAlign: 'center', lineHeight: 20 },
})

export const AllMediaScreen: React.FC<Props> = ({ fileKey, onOpenViewer, onBack }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('date_desc')

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

  const displayFiles = useMemo(() => {
    let result = filter === 'all' ? [...files] : files.filter(f => getMediaKind(f.mimeType) === filter)
    switch (sort) {
      case 'date_asc': result.sort((a, b) => a.importedAt - b.importedAt); break
      case 'size_desc': result.sort((a, b) => (b.size || 0) - (a.size || 0)); break
      default: result.sort((a, b) => b.importedAt - a.importedAt)
    }
    return result
  }, [files, filter, sort])

  const fileIds = displayFiles.map(f => f.id)

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

  const cycleSort = () => {
    const keys: SortType[] = ['date_desc', 'date_asc', 'size_desc']
    setSort(keys[(keys.indexOf(sort) + 1) % keys.length])
  }

  const currentSortOption = SORT_OPTIONS.find(o => o.key === sort)!

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Все медиа</Text>
        {!loading
          ? <Text style={styles.count}>{displayFiles.length}/{files.length}</Text>
          : <View style={styles.backBtn} />
        }
      </View>

      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 6 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipTxt, filter === f.key && styles.chipTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.sortBtn} onPress={cycleSort}>
          <Ionicons name={currentSortOption.icon} size={13} color={colors.subtext} />
          <Text style={styles.sortTxt}>{currentSortOption.label}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 }}>
            Ошибка загрузки:{'\n'}{loadError}
          </Text>
        </View>
      ) : displayFiles.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={48} color={colors.subtext} />
          <Text style={styles.emptyText}>{files.length === 0 ? 'Сейф пуст' : 'Нет совпадений'}</Text>
          <Text style={styles.emptyHint}>
            {files.length === 0
              ? 'Перейдите на вкладку «Импорт», чтобы добавить медиафайлы'
              : 'Попробуйте другой фильтр'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayFiles}
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
