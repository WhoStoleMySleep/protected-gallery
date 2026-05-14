import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { getAllFileIds, loadDailySelection, saveDailySelection, getFile } from '../storage/metadata'
import { getDailyLimit, DEFAULT_DAILY_LIMIT } from '../storage/settings'
import { selectDaily, getTodayKey } from '../utils/randomizer'
import { formatDate } from '../utils/media'
import type { VaultFile } from '../types'
import { COLORS } from '../theme'

const { width } = Dimensions.get('window')
const COLS = 3
const GAP = 2
const ITEM_SIZE = (width - GAP * (COLS + 1)) / COLS

interface Props {
  fileKey: Uint8Array
  onOpenViewer: (fileIds: string[], index: number) => void
}

export const DailyScreen: React.FC<Props> = ({ fileKey, onOpenViewer }) => {
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const today = getTodayKey()

  const loadDaily = useCallback(async () => {
    setLoadError(null)
    try {
      const [allIds, dailyLimit] = await Promise.all([getAllFileIds(), getDailyLimit()])
      let selectedIds: string[]

      if (allIds.length <= dailyLimit) {
        selectedIds = allIds
      } else {
        const cached = await loadDailySelection(today)
        if (cached && cached.length === dailyLimit) {
          selectedIds = cached
        } else {
          selectedIds = selectDaily(allIds, dailyLimit)
          await saveDailySelection(today, selectedIds)
        }
      }

      const loaded = await Promise.all(selectedIds.map(id => getFile(id)))
      setFiles(loaded.filter((f): f is VaultFile => f !== null))
    } catch (e: any) {
      setLoadError(e?.message ?? String(e))
    }
  }, [today])

  useEffect(() => {
    loadDaily().finally(() => setLoading(false))
  }, [loadDaily])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDaily()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 }}>
          Ошибка загрузки:{'\n'}{loadError}
        </Text>
      </View>
    )
  }

  const fileIds = files.map(f => f.id)
  const dateLabel = formatDate(Date.now())

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Сегодня</Text>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={styles.count}>
          {files.length === 0 ? 'Сейф пуст' : `Файлов сегодня: ${files.length}`}
        </Text>
      </View>

      {files.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyText}>Ваш сейф пуст</Text>
          <Text style={styles.emptyHint}>Перейдите на вкладку «Импорт», чтобы добавить медиафайлы</Text>
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
                onPress={() => onOpenViewer(fileIds, index)}
              />
            </View>
          )}
        />
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  date: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  count: { fontSize: 12, color: COLORS.accent, marginTop: 4, fontWeight: '600' },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', lineHeight: 20 },
})
