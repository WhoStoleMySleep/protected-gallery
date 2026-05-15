import React, { useState, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  FlatList, ActivityIndicator, StatusBar, InteractionManager,
  Animated, PanResponder, BackHandler, Alert,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Sharing from 'expo-sharing'
import { getFile } from '../storage/metadata'
import { updateFileMeta } from '../storage/metadata'
import { decryptToTemp } from '../storage/vault'
import { limit } from '../utils/concurrency'
import { getMediaKind, formatFileSize, formatDate, formatDuration } from '../utils/media'
import { ZoomableImage } from '../components/ZoomableImage'
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
  barsWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: { padding: 10, minWidth: 44, alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 18, fontWeight: '600' },
  counter: { color: '#fff', fontSize: 14, fontWeight: '600' },
  infoBtn: { padding: 10, minWidth: 44, alignItems: 'center' },
  infoOverlay: {
    position: 'absolute', bottom: 80, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 20, gap: 4,
  },
  infoName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  infoMeta: { color: c.subtextLight, fontSize: 13 },
  actionBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  actionBtn: { alignItems: 'center', gap: 4, padding: 8, minWidth: 60 },
  actionLabel: { color: '#fff', fontSize: 11 },
  actionLabelDanger: { color: '#ff6b6b', fontSize: 11 },
})

const ACTION_BAR_HEIGHT = 64

const VideoSlide: React.FC<{ uri: string; isActive: boolean }> = ({ uri, isActive }) => {
  const { bottom, top } = useSafeAreaInsets()
  const player = useVideoPlayer({ uri }, p => { p.loop = true })

  useEffect(() => {
    if (isActive) player.play()
    else player.pause()
  }, [isActive])

  const videoHeight = height - ACTION_BAR_HEIGHT - bottom - top - 44

  return (
    <VideoView
      player={player}
      style={{ width, height: videoHeight }}
      contentFit="contain"
      nativeControls
    />
  )
}

const FileSlide: React.FC<{
  fileId: string
  fileKey: Uint8Array
  visible: boolean
  isActive: boolean
  priority: 'high' | 'normal'
  onScaleChange?: (s: number) => void
  onSingleTap?: () => void
  barsVisible?: boolean
}> = ({ fileId, fileKey, visible, isActive, priority, onScaleChange, onSingleTap, barsVisible }) => {
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
        <VideoSlide uri={state.uri} isActive={isActive} />
      </View>
    )
  }

  if (kind === 'image' || kind === 'gif') {
    return (
      <View style={styles.slide}>
        <ZoomableImage uri={state.uri} onScaleChange={onScaleChange} onSingleTap={onSingleTap} />
      </View>
    )
  }

  return (
    <TouchableOpacity style={styles.slide} onPress={onSingleTap} activeOpacity={1}>
      <Ionicons name="document-outline" size={48} color={colors.subtext} />
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
        {state.file.originalName}
      </Text>
    </TouchableOpacity>
  )
}

export const ViewerScreen: React.FC<Props> = ({ fileIds: initialFileIds, initialIndex, fileKey, onClose }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [localFileIds, setLocalFileIds] = useState(initialFileIds)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [showInfo, setShowInfo] = useState(false)
  const [currentFile, setCurrentFile] = useState<VaultFile | null>(null)
  const [imageScale, setImageScale] = useState(1)

  const flatListRef = useRef<FlatList>(null)
  const translateY = useRef(new Animated.Value(0)).current
  const imageScaleRef = useRef(1)
  const barsOpacity = useRef(new Animated.Value(1)).current
  const [barsVisible, setBarsVisible] = useState(true)
  const barsVisibleRef = useRef(true)
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const hideBars = () => {
    if (autoHideTimer.current) { clearTimeout(autoHideTimer.current); autoHideTimer.current = null }
    barsVisibleRef.current = false
    setBarsVisible(false)
    Animated.timing(barsOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start()
  }

  const showBars = () => {
    barsVisibleRef.current = true
    setBarsVisible(true)
    Animated.timing(barsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current)
    autoHideTimer.current = setTimeout(hideBars, 3000)
  }

  const isPanning = useRef(false)

  const toggleBars = () => {
    if (isPanning.current) return
    if (isCurrentVideo) return
    if (barsVisibleRef.current) hideBars()
    else showBars()
  }

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
    onMoveShouldSetPanResponder: (_, { dy, dx }) => {
      if (imageScaleRef.current > 1.05) return false
      return dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.5
    },
    onPanResponderGrant: () => { isPanning.current = true },
    onPanResponderMove: (_, { dy }) => {
      if (dy > 0) translateY.setValue(dy)
    },
    onPanResponderRelease: (_, { dy, vy }) => {
      isPanning.current = false
      if (dy > DISMISS_THRESHOLD || vy > DISMISS_VELOCITY) {
        dismiss(vy)
      } else {
        snapBack()
      }
    },
    onPanResponderTerminate: () => { isPanning.current = false; snapBack() },
  })).current

  const isCurrentVideo = currentFile ? getMediaKind(currentFile.mimeType) === 'video' : false

  useEffect(() => {
    if (autoHideTimer.current) { clearTimeout(autoHideTimer.current); autoHideTimer.current = null }
    if (isCurrentVideo) {
      // для видео — панели всегда видны, без таймера скрытия
      barsVisibleRef.current = true
      setBarsVisible(true)
      Animated.timing(barsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
      return
    }
    autoHideTimer.current = setTimeout(hideBars, 2500)
    return () => { if (autoHideTimer.current) clearTimeout(autoHideTimer.current) }
  }, [isCurrentVideo])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss()
      return true
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    getFile(localFileIds[currentIndex]).then(setCurrentFile)
  }, [currentIndex, localFileIds])

  const handleScaleChange = (s: number) => {
    imageScaleRef.current = s
    setImageScale(s)
  }

  const removeCurrentFile = (fileId: string) => {
    const newIds = localFileIds.filter(id => id !== fileId)
    if (newIds.length === 0) {
      dismiss()
      return
    }
    const newIndex = Math.min(currentIndex, newIds.length - 1)
    setLocalFileIds(newIds)
    setCurrentIndex(newIndex)
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: false })
    }, 50)
  }

  const handleTrash = () => {
    if (!currentFile) return
    showBars()
    Alert.alert(
      'Удалить файл?',
      'Файл будет перемещён в корзину.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'В корзину',
          style: 'destructive',
          onPress: async () => {
            await updateFileMeta(currentFile.id, { status: 'trashed', trashedAt: Date.now() })
            removeCurrentFile(currentFile.id)
          },
        },
      ]
    )
  }

  const handleArchive = async () => {
    if (!currentFile) return
    showBars()
    const isArchived = currentFile.status === 'archived'
    await updateFileMeta(currentFile.id, { status: isArchived ? 'active' : 'archived' })
    if (!isArchived) {
      removeCurrentFile(currentFile.id)
    } else {
      const updated = await getFile(currentFile.id)
      setCurrentFile(updated)
    }
  }

  const handleShare = async () => {
    if (!currentFile) return
    showBars()
    try {
      const uri = await decryptToTemp(currentFile.encryptedPath, fileKey, currentFile.mimeType, currentFile.id)
      await Sharing.shareAsync(uri, { mimeType: currentFile.mimeType, dialogTitle: currentFile.originalName })
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось поделиться файлом.')
    }
  }

  const isArchived = currentFile?.status === 'archived'

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }, { scale }], borderRadius }]}
      {...panResponder.panHandlers}
    >
      <StatusBar hidden />
      <FlatList
        ref={flatListRef}
        data={localFileIds}
        keyExtractor={id => id}
        horizontal
        pagingEnabled
        scrollEnabled={imageScale <= 1.05}
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
            isActive={index === currentIndex}
            priority={index === currentIndex ? 'high' : 'normal'}
            onScaleChange={index === currentIndex ? handleScaleChange : undefined}
            onSingleTap={toggleBars}
            barsVisible={barsVisible}
          />
        )}
      />

      <Animated.View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: barsOpacity }}
        pointerEvents={barsVisible ? 'auto' : 'none'}
      >
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => dismiss()}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.counter}>{currentIndex + 1} / {localFileIds.length}</Text>
          <TouchableOpacity style={styles.infoBtn} onPress={() => { showBars(); setShowInfo(s => !s) }}>
            <Ionicons name={showInfo ? 'information-circle' : 'information-circle-outline'} size={22} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>

      {showInfo && currentFile && (
        <Animated.View style={[styles.infoOverlay, { opacity: barsOpacity }]} pointerEvents={barsVisible ? 'auto' : 'none'}>
          <Text style={styles.infoName} numberOfLines={2}>{currentFile.originalName}</Text>
          <Text style={styles.infoMeta}>{formatFileSize(currentFile.size)}</Text>
          <Text style={styles.infoMeta}>{formatDate(currentFile.importedAt)}</Text>
          {currentFile.duration != null && (
            <Text style={styles.infoMeta}>Длительность: {formatDuration(currentFile.duration)}</Text>
          )}
          {currentFile.width != null && (
            <Text style={styles.infoMeta}>{currentFile.width} × {currentFile.height}</Text>
          )}
        </Animated.View>
      )}

      <Animated.View
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: barsOpacity }}
        pointerEvents={barsVisible ? 'auto' : 'none'}
      >
        <SafeAreaView edges={['bottom']} style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#fff" />
            <Text style={styles.actionLabel}>Поделиться</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleArchive}>
            <Ionicons name={isArchived ? 'archive' : 'archive-outline'} size={24} color="#fff" />
            <Text style={styles.actionLabel}>{isArchived ? 'Убрать' : 'Архив'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleTrash}>
            <Ionicons name="trash-outline" size={24} color="#ff6b6b" />
            <Text style={styles.actionLabelDanger}>Удалить</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </Animated.View>
  )
}
