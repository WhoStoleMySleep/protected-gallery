import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { SelectionBar } from '../components/SelectionBar'
import { useSelection } from '../hooks/useSelection'
import { getActiveFileIds, loadDailySelection, saveDailySelection, getFile, updateFileMeta } from '../storage/metadata'
import { getDailyLimit } from '../storage/settings'
import { selectDaily, getTodayKey } from '../utils/randomizer'
import { formatDate } from '../utils/media'
import type { VaultFile } from '../types'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'
import { s } from '../i18n'

const { width } = Dimensions.get('window')
const COLS = 3
const GAP = 2
const ITEM_SIZE = (width - GAP * (COLS + 1)) / COLS

interface Props {
  fileKey: Uint8Array
  onOpenViewer: (fileIds: string[], index: number) => void
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  date: { fontSize: 13, color: c.subtext, marginTop: 2 },
  count: { fontSize: 12, color: c.accent, marginTop: 4, fontWeight: '600' },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: c.subtext, textAlign: 'center', lineHeight: 20 },
})

export const DailyScreen: React.FC<Props> = ({ fileKey, onOpenViewer }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const today = getTodayKey()

  const { selected, selectionMode, enterSelection, toggleItem, clearSelection } = useSelection()

  const loadDaily = useCallback(async () => {
    setLoadError(null)
    try {
      const [activeIds, dailyLimit] = await Promise.all([getActiveFileIds(), getDailyLimit()])
      let selectedIds: string[]

      if (activeIds.length <= dailyLimit) {
        selectedIds = activeIds
      } else {
        const cached = await loadDailySelection(today)
        if (cached) {
          const validCached = cached.filter(id => activeIds.includes(id))
          if (validCached.length === dailyLimit) {
            selectedIds = validCached
          } else {
            selectedIds = selectDaily(activeIds, dailyLimit)
            await saveDailySelection(today, selectedIds)
          }
        } else {
          selectedIds = selectDaily(activeIds, dailyLimit)
          await saveDailySelection(today, selectedIds)
        }
      }

      const loaded = await Promise.all(selectedIds.map(id => getFile(id)))
      setFiles(loaded.filter((f): f is VaultFile => f !== null))
    } catch (e: any) {
      setLoadError(e?.message ?? String(e))
    }
  }, [today])

  React.useEffect(() => {
    loadDaily().finally(() => setLoading(false))
  }, [loadDaily])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDaily()
    setRefreshing(false)
  }

  const archiveSelected = async () => {
    await Promise.all(Array.from(selected).map(id => updateFileMeta(id, { status: 'archived' })))
    clearSelection()
    await loadDaily()
  }

  const trashSelected = async () => {
    const now = Date.now()
    await Promise.all(Array.from(selected).map(id => updateFileMeta(id, { status: 'trashed', trashedAt: now })))
    clearSelection()
    await loadDaily()
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 }}>
          {s.daily.loadError}{'\n'}{loadError}
        </Text>
      </View>
    )
  }

  const fileIds = files.map(f => f.id)

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{s.daily.title}</Text>
        <Text style={styles.date}>{formatDate(Date.now())}</Text>
        <Text style={styles.count}>
          {files.length === 0 ? s.daily.vaultEmpty : s.daily.count(files.length)}
        </Text>
      </View>

      {files.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyText}>{s.daily.emptyText}</Text>
          <Text style={styles.emptyHint}>{s.daily.emptyHint}</Text>
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
            { label: s.selection.archive, onPress: archiveSelected },
            { label: s.selection.trash, danger: true, onPress: trashSelected },
          ]}
        />
      )}
    </SafeAreaView>
  )
}
