import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { SelectionBar } from '../components/SelectionBar'
import { useSelection } from '../hooks/useSelection'
import { getFilesByStatus, updateFileMeta } from '../storage/metadata'
import { permanentlyDeleteFiles } from '../storage/vault'
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

export const TrashScreen: React.FC<Props> = ({ fileKey, onOpenViewer, onBack }) => {
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { selected, selectionMode, enterSelection, toggleItem, clearSelection } = useSelection()

  const loadTrash = useCallback(async () => {
    const trashed = await getFilesByStatus('trashed')
    trashed.sort((a, b) => (b.trashedAt ?? b.importedAt) - (a.trashedAt ?? a.importedAt))
    setFiles(trashed)
  }, [])

  React.useEffect(() => {
    loadTrash().finally(() => setLoading(false))
  }, [loadTrash])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadTrash()
    setRefreshing(false)
  }

  const restore = async () => {
    await Promise.all(Array.from(selected).map(id => updateFileMeta(id, { status: 'active', trashedAt: undefined })))
    clearSelection()
    await loadTrash()
  }

  const deletePermanently = () => {
    const count = selected.size
    Alert.alert(
      'Удалить навсегда?',
      `${count} файл${count === 1 ? '' : count < 5 ? 'а' : 'ов'} будут безвозвратно удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await permanentlyDeleteFiles(files.filter(f => selected.has(f.id)))
            clearSelection()
            await loadTrash()
          },
        },
      ],
    )
  }

  const clearAll = () => {
    if (files.length === 0) return
    Alert.alert(
      'Очистить корзину?',
      `Все ${files.length} файлов будут безвозвратно удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: async () => {
            await permanentlyDeleteFiles(files)
            clearSelection()
            await loadTrash()
          },
        },
      ],
    )
  }

  const fileIds = files.map(f => f.id)

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Корзина</Text>
          {!loading && files.length > 0 && (
            <Text style={styles.subtitle}>Автоочистка через 30 дней</Text>
          )}
        </View>
        {!loading && files.length > 0 ? (
          <TouchableOpacity onPress={clearAll} style={styles.backBtn}>
            <Text style={[styles.backTxt, { color: COLORS.danger, textAlign: 'right' }]}>Очистить</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>
      ) : files.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗑</Text>
          <Text style={styles.emptyText}>Корзина пуста</Text>
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
            { label: 'Удалить', danger: true, onPress: deletePermanently },
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
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 11, color: COLORS.subtext, marginTop: 2 },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
})
