import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, InteractionManager } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { VaultFile } from '../types'
import { getMediaKind, formatDuration, normalizeDuration } from '../utils/media'
import { decryptToTemp } from '../storage/vault'
import { limit } from '../utils/concurrency'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

const uriCache = new Map<string, string>()

interface Props {
  file: VaultFile
  fileKey: Uint8Array
  size: number
  onPress: () => void
  onLongPress?: () => void
  selected?: boolean
  selectionMode?: boolean
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { borderRadius: 6, overflow: 'hidden', backgroundColor: c.card },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 6, left: 6, right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoIcon: { textShadowColor: '#000', textShadowRadius: 3 },
  duration: { color: '#fff', fontSize: 10, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 },
  fileName: { color: c.subtext, fontSize: 10, textAlign: 'center', paddingHorizontal: 4, marginTop: 4 },
  selectionBadge: {
    position: 'absolute', top: 5, right: 5,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  selectionBadgeOn: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
})

export const MediaThumbnail: React.FC<Props> = ({ file, fileKey, size, onPress, onLongPress, selected, selectionMode }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const cached = uriCache.get(file.id)
  const [uri, setUri] = useState<string | null>(cached ?? null)
  const [loading, setLoading] = useState(!cached)
  const [failed, setFailed] = useState(false)
  const kind = getMediaKind(file.mimeType)

  useEffect(() => {
    if (cached || kind === 'unknown') return
    let cancelled = false
    const task = InteractionManager.runAfterInteractions(() => {
      limit(async () => {
        if (cancelled) return
        try {
          const src = file.thumbPath ?? file.encryptedPath
          const cacheKey = file.thumbPath ? file.id + '_thumb' : file.id
          const mime = file.thumbPath ? 'image/jpeg' : file.mimeType
          const tempUri = await decryptToTemp(src, fileKey, mime, cacheKey)
          uriCache.set(file.id, tempUri)
          if (!cancelled) { setUri(tempUri); setLoading(false) }
        } catch {
          if (!cancelled) { setFailed(true); setLoading(false) }
        }
      })
    })
    return () => { cancelled = true; task.cancel() }
  }, [file.id])

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.8}
    >
      {loading && (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}

      {!loading && failed && (
        <View style={styles.placeholder}>
          <Ionicons name="warning-outline" size={28} color={colors.subtext} />
        </View>
      )}

      {!loading && !failed && uri && (kind === 'image' || kind === 'gif') && (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}

      {!loading && !failed && kind === 'video' && (
        <View style={styles.placeholder}>
          {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
          <View style={styles.videoOverlay}>
            <Ionicons name="play" size={13} color="#fff" style={styles.videoIcon} />
            {file.duration != null && (
              <Text style={styles.duration}>{formatDuration(normalizeDuration(file.duration))}</Text>
            )}
          </View>
        </View>
      )}

      {!loading && !failed && kind === 'unknown' && (
        <View style={styles.placeholder}>
          <Ionicons name="document-outline" size={28} color={colors.subtext} />
          <Text style={styles.fileName} numberOfLines={2}>{file.originalName}</Text>
        </View>
      )}

      {selectionMode && (
        <View style={[styles.selectionBadge, selected && styles.selectionBadgeOn]}>
          {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
      )}
    </TouchableOpacity>
  )
}

export const clearUriCache = () => uriCache.clear()
