import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import type { VaultFile } from '../types'
import { getMediaKind, formatDuration } from '../utils/media'
import { decryptToTemp } from '../storage/vault'
import { COLORS } from '../theme'

interface Props {
  file: VaultFile
  fileKey: Uint8Array
  size: number
  onPress: () => void
}

export const MediaThumbnail: React.FC<Props> = ({ file, fileKey, size, onPress }) => {
  const [uri, setUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const kind = getMediaKind(file.mimeType)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const tempUri = await decryptToTemp(file.encryptedPath, fileKey, file.mimeType)
        if (!cancelled) setUri(tempUri)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (kind !== 'unknown') load()
    else setLoading(false)
    return () => { cancelled = true }
  }, [file.id])

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {loading && (
        <View style={styles.placeholder}>
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      )}

      {!loading && failed && (
        <View style={styles.placeholder}>
          <Text style={styles.icon}>⚠️</Text>
        </View>
      )}

      {!loading && !failed && uri && (kind === 'image' || kind === 'gif') && (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}

      {!loading && !failed && kind === 'video' && (
        <View style={styles.placeholder}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <View style={styles.videoOverlay}>
            <Text style={styles.videoIcon}>▶</Text>
            {file.duration != null && (
              <Text style={styles.duration}>{formatDuration(file.duration)}</Text>
            )}
          </View>
        </View>
      )}

      {!loading && !failed && kind === 'unknown' && (
        <View style={styles.placeholder}>
          <Text style={styles.icon}>📄</Text>
          <Text style={styles.fileName} numberOfLines={2}>{file.originalName}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { borderRadius: 6, overflow: 'hidden', backgroundColor: COLORS.card },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 6, left: 6, right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoIcon: { color: '#fff', fontSize: 14, textShadowColor: '#000', textShadowRadius: 3 },
  duration: { color: '#fff', fontSize: 10, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 },
  icon: { fontSize: 28 },
  fileName: { color: COLORS.subtext, fontSize: 10, textAlign: 'center', paddingHorizontal: 4, marginTop: 4 },
})
