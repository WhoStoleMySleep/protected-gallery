import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, TouchableOpacity, Alert, BackHandler,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { SelectionBar } from '../components/SelectionBar'
import { useSelection } from '../hooks/useSelection'
import { getFilesByStatus, updateFileMeta } from '../storage/metadata'
import { permanentlyDeleteFiles } from '../storage/vault'
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
  onBack: () => void
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { minWidth: 64 },
  backTxt: { color: c.accent, fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  subtitle: { fontSize: 11, color: c.subtext, marginTop: 2 },
  grid: { padding: GAP / 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: c.text },
})

export const TrashScreen: React.FC<Props> = ({ fileKey, onOpenViewer, onBack }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { selected, selectionMode, enterSelection, toggleItem, clearSelection } = useSelection()

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true })
    return () => sub.remove()
  }, [onBack])

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
      s.trash.deleteTitle,
      s.trash.deleteMsg(count),
      [
        { text: s.trash.cancel, style: 'cancel' },
        {
          text: s.trash.deleteBtn,
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
      s.trash.clearTitle,
      s.trash.clearMsg(files.length),
      [
        { text: s.trash.cancel, style: 'cancel' },
        {
          text: s.trash.clearConfirm,
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
          <Text style={styles.backTxt}>{s.trash.back}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{s.trash.title}</Text>
          {!loading && files.length > 0 && (
            <Text style={styles.subtitle}>{s.trash.autoPurge}</Text>
          )}
        </View>
        {!loading && files.length > 0 ? (
          <TouchableOpacity onPress={clearAll} style={styles.backBtn}>
            <Text style={[styles.backTxt, { color: colors.danger, textAlign: 'right' }]}>{s.trash.clearBtn}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : files.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trash-outline" size={48} color={colors.subtext} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>{s.trash.empty}</Text>
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
            { label: s.selection.restore, onPress: restore },
            { label: s.selection.delete, danger: true, onPress: deletePermanently },
          ]}
        />
      )}
    </SafeAreaView>
  )
}
