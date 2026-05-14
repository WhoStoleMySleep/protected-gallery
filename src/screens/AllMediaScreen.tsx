import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { getAllFileIds, getFile } from '../storage/metadata'
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

export const AllMediaScreen: React.FC<Props> = ({ fileKey, onOpenViewer, onBack }) => {
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoadError(null)
    try {
      const allIds = await getAllFileIds()
      const loaded = await Promise.all(allIds.map(id => getFile(id)))
      const valid = loaded.filter((f): f is VaultFile => f !== null)
      valid.sort((a, b) => b.importedAt - a.importedAt)
      setFiles(valid)
    } catch (e: any) {
      setLoadError(e?.message ?? String(e))
    }
  }, [])

  useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [loadAll])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  const fileIds = files.map(f => f.id)

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Все медиа</Text>
        {!loading && (
          <Text style={styles.count}>{files.length} файлов</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
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
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { marginBottom: 4 },
  backTxt: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  count: { fontSize: 12, color: COLORS.accent, marginTop: 4, fontWeight: '600' },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', lineHeight: 20 },
})
