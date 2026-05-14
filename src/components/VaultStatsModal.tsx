import React, { useEffect, useState } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { getAllFiles } from '../storage/metadata'
import { getMediaKind } from '../utils/media'
import { formatFileSize } from '../utils/media'
import { COLORS } from '../theme'
import type { VaultFile } from '../types'

interface Stats {
  total: number
  totalSize: number
  image: { count: number; size: number }
  video: { count: number; size: number }
  gif: { count: number; size: number }
  other: { count: number; size: number }
}

const buildStats = (files: VaultFile[]): Stats => {
  const s: Stats = {
    total: files.length,
    totalSize: 0,
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    gif: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  }
  for (const f of files) {
    s.totalSize += f.size
    const k = getMediaKind(f.mimeType)
    if (k === 'image') { s.image.count++; s.image.size += f.size }
    else if (k === 'video') { s.video.count++; s.video.size += f.size }
    else if (k === 'gif') { s.gif.count++; s.gif.size += f.size }
    else { s.other.count++; s.other.size += f.size }
  }
  return s
}

interface Props {
  visible: boolean
  onClose: () => void
}

export const VaultStatsModal: React.FC<Props> = ({ visible, onClose }) => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    getAllFiles()
      .then(files => setStats(buildStats(files)))
      .finally(() => setLoading(false))
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>Файлы в сейфе</Text>

          {loading || !stats ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalNum}>{stats.total}</Text>
                <Text style={styles.totalLabel}>файлов</Text>
                <Text style={styles.totalSize}>{formatFileSize(stats.totalSize)}</Text>
              </View>

              <View style={styles.divider} />

              {[
                { label: 'Фото', icon: '🖼', data: stats.image },
                { label: 'Видео', icon: '🎬', data: stats.video },
                { label: 'GIF', icon: '🎞', data: stats.gif },
                { label: 'Другое', icon: '📄', data: stats.other },
              ].filter(r => r.data.count > 0).map(row => (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.rowIcon}>{row.icon}</Text>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowCount}>{row.data.count} шт.</Text>
                  <Text style={styles.rowSize}>{formatFileSize(row.data.size)}</Text>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Закрыть</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  totalRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16,
  },
  totalNum: { fontSize: 42, fontWeight: '800', color: COLORS.accent },
  totalLabel: { fontSize: 16, color: COLORS.subtext, flex: 1 },
  totalSize: { fontSize: 15, color: COLORS.subtextLight, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowIcon: { fontSize: 20, width: 28 },
  rowLabel: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  rowCount: { fontSize: 14, color: COLORS.subtextLight, marginRight: 8 },
  rowSize: { fontSize: 14, color: COLORS.accent, fontWeight: '600', minWidth: 72, textAlign: 'right' },
  closeBtn: {
    marginTop: 20, alignItems: 'center', paddingVertical: 14,
    backgroundColor: COLORS.background, borderRadius: 12,
  },
  closeTxt: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
})
