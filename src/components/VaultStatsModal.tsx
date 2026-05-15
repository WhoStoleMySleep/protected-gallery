import React, { useEffect, useState } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getAllFiles } from '../storage/metadata'
import { getMediaKind } from '../utils/media'
import { formatFileSize } from '../utils/media'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'
import type { VaultFile } from '../types'
import { s } from '../i18n'

interface Stats {
  total: number
  totalSize: number
  image: { count: number; size: number }
  video: { count: number; size: number }
  gif: { count: number; size: number }
  other: { count: number; size: number }
}

const buildStats = (files: VaultFile[]): Stats => {
  const st: Stats = {
    total: files.length,
    totalSize: 0,
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    gif: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  }
  for (const f of files) {
    st.totalSize += f.size
    const k = getMediaKind(f.mimeType)
    if (k === 'image') { st.image.count++; st.image.size += f.size }
    else if (k === 'video') { st.video.count++; st.video.size += f.size }
    else if (k === 'gif') { st.gif.count++; st.gif.size += f.size }
    else { st.other.count++; st.other.size += f.size }
  }
  return st
}

interface Props {
  visible: boolean
  onClose: () => void
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  title: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 20 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  totalNum: { fontSize: 42, fontWeight: '800', color: c.accent },
  totalLabel: { fontSize: 16, color: c.subtext, flex: 1 },
  totalSize: { fontSize: 15, color: c.subtextLight, fontWeight: '600' },
  divider: { height: 1, backgroundColor: c.border, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  rowIcon: { width: 28 },
  rowLabel: { flex: 1, fontSize: 15, color: c.text, fontWeight: '500' },
  rowCount: { fontSize: 14, color: c.subtextLight, marginRight: 8 },
  rowSize: { fontSize: 14, color: c.accent, fontWeight: '600', minWidth: 72, textAlign: 'right' },
  closeBtn: {
    marginTop: 20, alignItems: 'center', paddingVertical: 14,
    backgroundColor: c.background, borderRadius: 12,
  },
  closeTxt: { color: c.text, fontWeight: '600', fontSize: 15 },
})

export const VaultStatsModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    getAllFiles()
      .then(files => setStats(buildStats(files)))
      .finally(() => setLoading(false))
  }, [visible])

  const rows = stats ? [
    { label: s.stats.photos, icon: 'image-outline' as const, data: stats.image },
    { label: s.stats.videos, icon: 'videocam-outline' as const, data: stats.video },
    { label: s.stats.gifs, icon: 'film-outline' as const, data: stats.gif },
    { label: s.stats.other, icon: 'document-outline' as const, data: stats.other },
  ].filter(r => r.data.count > 0) : []

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>{s.stats.title}</Text>

          {loading || !stats ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalNum}>{stats.total}</Text>
                <Text style={styles.totalLabel}>{s.stats.filesLabel}</Text>
                <Text style={styles.totalSize}>{formatFileSize(stats.totalSize)}</Text>
              </View>

              <View style={styles.divider} />

              {rows.map(row => (
                <View key={row.label} style={styles.row}>
                  <Ionicons name={row.icon} size={20} color={colors.subtext} style={styles.rowIcon} />
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowCount}>{s.stats.pieces(row.data.count)}</Text>
                  <Text style={styles.rowSize}>{formatFileSize(row.data.size)}</Text>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>{s.stats.close}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
