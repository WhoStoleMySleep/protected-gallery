import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { File } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import { encryptAndSave, generateAndEncryptThumb } from '../storage/vault'
import { saveFile, getAllFileIds } from '../storage/metadata'
import { VaultStatsModal } from '../components/VaultStatsModal'
import { formatFileSize } from '../utils/media'
import { COLORS } from '../theme'
import type { VaultFile } from '../types'

interface Props {
  fileKey: Uint8Array
  onImportDone: () => void
}

interface Progress {
  current: number
  total: number
  name: string
}

export const ImportScreen: React.FC<Props> = ({ fileKey, onImportDone }) => {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [totalInVault, setTotalInVault] = useState(0)
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => {
    getAllFileIds().then(ids => setTotalInVault(ids.length))
  }, [])

  const pickAndImport = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos', 'livePhotos'] as any,
      allowsMultipleSelection: true,
      quality: 1,
      exif: false,
    })

    if (result.canceled || result.assets.length === 0) return

    const assets = result.assets
    const oversized = assets.filter(a => a.fileSize && a.fileSize > 500 * 1024 * 1024)
    if (oversized.length > 0) {
      Alert.alert(
        'Предупреждение',
        `${oversized.length} файлов(а) больше 500 МБ. Импорт может занять много времени.`,
        [
          { text: 'Продолжить', onPress: () => doImport(assets) },
          { text: 'Отмена', style: 'cancel' },
        ]
      )
      return
    }

    await doImport(assets)
  }

  const doImport = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setImporting(true)
    let success = 0
    let failed = 0

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]
      const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'file'
      setProgress({ current: i + 1, total: assets.length, name })

      try {
        const id = randomUUID()
        const mimeType = asset.mimeType ?? 'application/octet-stream'
        const srcFile = new File(asset.uri)
        const size = srcFile.size || asset.fileSize || 0
        const [encUri, thumbPath] = await Promise.all([
          encryptAndSave(asset.uri, id, fileKey),
          generateAndEncryptThumb(asset.uri, id, mimeType, fileKey),
        ])

        const vaultFile: VaultFile = {
          id,
          originalName: name,
          mimeType,
          size,
          importedAt: Date.now(),
          encryptedPath: encUri,
          thumbPath: thumbPath ?? undefined,
          width: asset.width,
          height: asset.height,
          duration: asset.duration ? asset.duration * 1000 : undefined,
        }
        await saveFile(vaultFile)
        success++
      } catch (e) {
        console.warn('Import failed for', name, e)
        failed++
      }
    }

    setImporting(false)
    setProgress(null)
    const total = await getAllFileIds()
    setTotalInVault(total.length)

    const msg = failed > 0
      ? `Скопировано: ${success}. Ошибок: ${failed}.\n\nОригиналы остались в галерее. Вы можете удалить их вручную.`
      : `Скопировано ${success} файлов(а).\n\nОригиналы остались в галерее. Удалите их вручную при желании.`

    Alert.alert('Импорт завершён', msg, [{ text: 'OK', onPress: onImportDone }])
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Импорт медиа</Text>
        <Text style={styles.subtitle}>
          Файлы копируются и шифруются внутри сейфа. Оригиналы в галерее не изменяются.
        </Text>

        <TouchableOpacity style={styles.statsCard} onPress={() => setStatsVisible(true)} activeOpacity={0.7}>
          <Text style={styles.statsLabel}>Файлов в сейфе</Text>
          <Text style={styles.statsValue}>{totalInVault}</Text>
        </TouchableOpacity>

        {importing ? (
          <View style={styles.progressCard}>
            <ActivityIndicator color={COLORS.accent} size="small" />
            <Text style={styles.progressText}>
              {progress
                ? `Шифрование ${progress.current}/${progress.total}: ${progress.name}`
                : 'Подготовка...'}
            </Text>
            {progress && (
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(progress.current / progress.total) * 100}%` },
                  ]}
                />
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.importBtn} onPress={pickAndImport}>
            <Ionicons name="cloud-download-outline" size={40} color={COLORS.accent} style={styles.importIcon} />
            <Text style={styles.importText}>Выбрать из галереи</Text>
            <Text style={styles.importHint}>Фото, видео, GIF</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Как работает сейф</Text>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed-outline" size={15} color={COLORS.subtext} style={styles.infoIcon} />
            <Text style={styles.infoItem}>Шифрование AES-256-GCM</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="folder-open-outline" size={15} color={COLORS.subtext} style={styles.infoIcon} />
            <Text style={styles.infoItem}>Оригиналы в галерее не затрагиваются</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shuffle-outline" size={15} color={COLORS.subtext} style={styles.infoIcon} />
            <Text style={styles.infoItem}>Каждый день — случайные 25 файлов</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="eye-off-outline" size={15} color={COLORS.subtext} style={styles.infoIcon} />
            <Text style={styles.infoItem}>Без PIN данные недоступны</Text>
          </View>
        </View>
      </ScrollView>
      <VaultStatsModal visible={statsVisible} onClose={() => setStatsVisible(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.subtext, lineHeight: 20 },
  statsCard: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statsLabel: { fontSize: 15, color: COLORS.subtext },
  statsValue: { fontSize: 28, fontWeight: '800', color: COLORS.accent },
  importBtn: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.accent, borderStyle: 'dashed',
  },
  importIcon: { marginBottom: 8 },
  importText: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  importHint: { fontSize: 13, color: COLORS.subtext },
  progressCard: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 20, gap: 12, alignItems: 'center',
  },
  progressText: { color: COLORS.subtext, fontSize: 13, textAlign: 'center' },
  progressBar: { height: 4, backgroundColor: COLORS.cardAlt, borderRadius: 2, width: '100%' },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  infoCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, gap: 10 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: {},
  infoItem: { fontSize: 13, color: COLORS.subtext, lineHeight: 19, flex: 1 },
})
