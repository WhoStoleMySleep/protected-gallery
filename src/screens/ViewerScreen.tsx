import React, { useState, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  FlatList, ActivityIndicator, StatusBar, InteractionManager,
  Animated, PanResponder, BackHandler,
} from 'react-native'
import { Image } from 'expo-image'
import { VideoView, useVideoPlayer } from 'expo-video'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getFile } from '../storage/metadata'
import { decryptToTemp } from '../storage/vault'
import { limit } from '../utils/concurrency'
import { getMediaKind, formatFileSize, formatDate, formatDuration } from '../utils/media'
import type { VaultFile } from '../types'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

const { width, height } = Dimensions.get('window')
const DISMISS_THRESHOLD = 130
const DISMISS_VELOCITY = 0.6

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

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  slide: { width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
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
  infoMeta: { color: c.subtextLight, fontSize: 13 },
})

const VideoSlide: React.FC<{ uri: string; visible: boolean }> = ({ uri, visible }) => {
  const player = useVideoPlayer({ uri }, p => {
    p.loop = true
    if (visible) p.play()
  })

  useEffect(() => {
    if (visible) player.play()
    else player.pause()
  }, [visible])

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="contain"
      nativeControls
    />
  )
}

const FileSlide: React.FC<{ fileId: string; fileKey: Uint8Array; visible: boolean; priority: 'high' | 'normal' }> = ({
  fileId, fileKey, visible, priority,
}) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [state, setState] = useState<FileState>({ file: null, uri: null, loading: true, error: false })

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const task = InteractionManager.runAfterInteractions(() => {
      limit(async () => {
        if (cancelled) return
        setState(s => ({ ...s, loading: true, error: false }))
        try {
          const file = await getFile(fileId)
          if (!file || cancelled) return
          const uri = await decryptToTemp(file.encryptedPath, fileKey, file.mimeType, fileId)
          if (!cancelled) setState({ file, uri, loading: false, error: false })
        } catch {
          if (!cancelled) setState(s => ({ ...s, loading: false, error: true }))
        }
      }, priority)
    })
    return () => { cancelled = true; task.cancel() }
  }, [fileId, visible])

  if (state.loading) {
    return (
      <View style={styles.slide}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (state.error || !state.file || !state.uri) {
    return (
      <View style={styles.slide}>
        <Ionicons name="warning-outline" size={32} color={colors.subtext} />
        <Text style={{ color: colors.subtext, marginTop: 8 }}>Ошибка загрузки</Text>
      </View>
    )
  }

  const kind = getMediaKind(state.file.mimeType)

  if (kind === 'video') {
    return (
      <View style={styles.slide}>
        <VideoSlide uri={state.uri} visible={visible} />
      </View>
    )
  }

  if (kind === 'image' || kind === 'gif') {
    return (
      <View style={styles.slide}>
        <Image source={{ uri: state.uri }} style={styles.media} contentFit="contain" />
      </View>
    )
  }

  return (
    <View style={styles.slide}>
      <Ionicons name="document-outline" size={48} color={colors.subtext} />
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
        {state.file.originalName}
      </Text>
    </View>
  )
}

export const ViewerScreen: React.FC<Props> = ({ fileIds, initialIndex, fileKey, onClose }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [showInfo, setShowInfo] = useState(false)
  const [currentFile, setCurrentFile] = useState<VaultFile | null>(null)

  const translateY = useRef(new Animated.Value(0)).current

  const borderRadius = translateY.interpolate({
    inputRange: [0, DISMISS_THRESHOLD],
    outputRange: [0, 20],
    extrapolate: 'clamp',
  })

  const scale = translateY.interpolate({
    inputRange: [0, height],
    outputRange: [1, 0.88],
    extrapolate: 'clamp',
  })

  const dismiss = (velocity = 0) => {
    const duration = velocity > 0 ? Math.max(100, Math.min(250, 200 / velocity)) : 220
    Animated.timing(translateY, {
      toValue: height,
      duration,
      useNativeDriver: true,
    }).start(onClose)
  }

  const snapBack = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start()
  }

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dy, dx }) =>
      dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.5,
    onPanResponderMove: (_, { dy }) => {
      if (dy > 0) translateY.setValue(dy)
    },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > DISMISS_THRESHOLD || vy > DISMISS_VELOCITY) {
        dismiss(vy)
      } else {
        snapBack()
      }
    },
    onPanResponderTerminate: () => {
      snapBack()
    },
  })).current

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss()
      return true
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    getFile(fileIds[currentIndex]).then(setCurrentFile)
  }, [currentIndex])

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }, { scale }], borderRadius }]}
      {...panResponder.panHandlers}
    >
      <StatusBar hidden />
      <FlatList
        data={fileIds}
        keyExtractor={id => id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={e => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }}
        renderItem={({ item, index }) => (
          <FileSlide
            fileId={item}
            fileKey={fileKey}
            visible={Math.abs(index - currentIndex) <= 1}
            priority={index === currentIndex ? 'high' : 'normal'}
          />
        )}
      />

      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => dismiss()}>
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
    </Animated.View>
  )
}
