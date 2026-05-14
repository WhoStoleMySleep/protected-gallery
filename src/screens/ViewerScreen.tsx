import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  FlatList, ActivityIndicator, StatusBar,
} from 'react-native'
import { Image } from 'expo-image'
import { Video, ResizeMode } from 'expo-av'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getFile } from '../storage/metadata'
import { decryptToTemp } from '../storage/vault'
import { getMediaKind, formatFileSize, formatDate, formatDuration } from '../utils/media'
import type { VaultFile } from '../types'
import { COLORS } from '../theme'

const { width, height } = Dimensions.get('window')

interface Props {
  fileIds: string[]
  initialIndex: number
  fileKey: Uint8Array
  onClose: () => void
}

interface FileState {
  file: VaultFile | null
  uri: string | null
  loading: boolean
  error: boolean
}

const FileViewer: React.FC<{ fileId: string; fileKey: Uint8Array; visible: boolean }> = ({
  fileId, fileKey, visible,
}) => {
  const [state, setState] = useState<FileState>({ file: null, uri: null, loading: true, error: false })

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const load = async () => {
      setState(s => ({ ...s, loading: true }))
      try {
        const file = await getFile(fileId)
        if (!file || cancelled) return
        const uri = await decryptToTemp(file.encryptedPath, fileKey, file.mimeType)
        if (!cancelled) setState({ file, uri, loading: false, error: false })
      } catch {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: true }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [fileId, visible])

  if (state.loading) {
    return (
      <View style={styles.slide}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    )
  }

  if (state.error || !state.file || !state.uri) {
    return (
      <View style={styles.slide}>
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Text style={{ color: COLORS.subtext, marginTop: 8 }}>Ошибка загрузки</Text>
      </View>
    )
  }

  const kind = getMediaKind(state.file.mimeType)

  return (
    <View style={styles.slide}>
      {(kind === 'image' || kind === 'gif') && (
        <Image
          source={{ uri: state.uri }}
          style={styles.media}
          contentFit="contain"
        />
      )}
      {kind === 'video' && (
        <Video
          source={{ uri: state.uri }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={visible}
          isLooping
          useNativeControls
        />
      )}
      {kind === 'unknown' && (
        <View style={[styles.slide, { gap: 12 }]}>
          <Text style={{ fontSize: 48 }}>📄</Text>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '600' }}>
            {state.file.originalName}
          </Text>
        </View>
      )}
    </View>
  )
}

export const ViewerScreen: React.FC<Props> = ({ fileIds, initialIndex, fileKey, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [showInfo, setShowInfo] = useState(false)
  const [currentFile, setCurrentFile] = useState<VaultFile | null>(null)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    getFile(fileIds[currentIndex]).then(setCurrentFile)
  }, [currentIndex])

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <FlatList
        ref={listRef}
        data={fileIds}
        keyExtractor={id => id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width)
          setCurrentIndex(idx)
        }}
        renderItem={({ item, index }) => (
          <FileViewer
            fileId={item}
            fileKey={fileKey}
            visible={Math.abs(index - currentIndex) <= 1}
          />
        )}
      />

      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.counter}>{currentIndex + 1} / {fileIds.length}</Text>
        <TouchableOpacity style={styles.infoBtn} onPress={() => setShowInfo(s => !s)}>
          <Text style={styles.infoTxt}>ℹ</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {showInfo && currentFile && (
        <View style={styles.infoOverlay}>
          <Text style={styles.infoName} numberOfLines={2}>{currentFile.originalName}</Text>
          <Text style={styles.infoMeta}>{formatFileSize(currentFile.size)}</Text>
          <Text style={styles.infoMeta}>{formatDate(currentFile.importedAt)}</Text>
          {currentFile.duration != null && (
            <Text style={styles.infoMeta}>Длительность: {formatDuration(currentFile.duration)}</Text>
          )}
          {currentFile.width != null && (
            <Text style={styles.infoMeta}>{currentFile.width} × {currentFile.height}</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: {
    width, height,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000',
  },
  media: { width, height },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: { padding: 10, minWidth: 44, alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 18, fontWeight: '600' },
  counter: { color: '#fff', fontSize: 14, fontWeight: '600' },
  infoBtn: { padding: 10, minWidth: 44, alignItems: 'center' },
  infoTxt: { color: '#fff', fontSize: 18 },
  infoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 20, paddingBottom: 40, gap: 4,
  },
  infoName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  infoMeta: { color: COLORS.subtextLight, fontSize: 13 },
})
