import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { deletePin } from '../crypto/pin'
import { deleteMasterKey } from '../crypto/keys'
import { clearAllMeta } from '../storage/metadata'
import { clearVault } from '../storage/vault'
import { getDailyLimit, setDailyLimit } from '../storage/settings'
import { clearDecryptedCache } from '../storage/decryptedCache'
import { COLORS } from '../theme'

const LIMIT_OPTIONS = [10, 15, 20, 25, 30, 40, 50]

interface Props {
  onLock: () => void
  onResetComplete: () => void
  onChangePin: () => void
  onAllMedia: () => void
  onTrash: () => void
  onArchive: () => void
  onSafeModeSetup: () => void
  vaultMode: 'real' | 'safe'
}

export const SettingsScreen: React.FC<Props> = ({ onLock, onResetComplete, onChangePin, onAllMedia, onTrash, onArchive, onSafeModeSetup, vaultMode }) => {
  const [loading, setLoading] = useState(false)
  const [dailyLimit, setDailyLimitState] = useState(25)

  useEffect(() => {
    getDailyLimit().then(v => { setDailyLimitState(v); setLimitInput(String(v)) })
  }, [])

  const [limitInput, setLimitInput] = useState('')

  const changeDailyLimit = async (val: number) => {
    const clamped = Math.max(1, val)
    setDailyLimitState(clamped)
    setLimitInput(String(clamped))
    await setDailyLimit(clamped)
  }

  const handleLimitInput = (text: string) => {
    setLimitInput(text)
    const num = parseInt(text, 10)
    if (!isNaN(num) && num > 0) changeDailyLimit(num)
  }

  const confirmDeleteAll = () => {
    Alert.alert(
      'Удалить всё?',
      'Все зашифрованные файлы и метаданные будут безвозвратно удалены. Это действие невозможно отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: deleteAll,
        },
      ]
    )
  }

  const deleteAll = async () => {
    setLoading(true)
    try {
      await clearAllMeta()
      await clearVault()
      await clearDecryptedCache()
      await deletePin()
      await deleteMasterKey()
      onResetComplete()
    } finally {
      setLoading(false)
    }
  }

  const showAbout = () => {
    Alert.alert(
      'О приложении',
      'Личный зашифрованный медиасейф\n\nВерсия 1.0.0\n\nФайлы хранятся только локально на устройстве и зашифрованы алгоритмом AES-256-GCM.\n\nПриложение никогда не отправляет данные в интернет и не удаляет оригиналы из галереи.',
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={{ color: COLORS.subtext, marginTop: 12 }}>Удаление данных...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Настройки</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ЕЖЕДНЕВНАЯ ПОДБОРКА</Text>
          <View style={[styles.row, styles.rowNoBorder]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Файлов в день</Text>
              <Text style={styles.rowDesc}>Сколько файлов показывать во вкладке «Сегодня»</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.limitInput}
                  value={limitInput}
                  onChangeText={handleLimitInput}
                  keyboardType="number-pad"
                  placeholder="Число"
                  placeholderTextColor={COLORS.subtext}
                  maxLength={4}
                  returnKeyType="done"
                />
                <Text style={styles.limitInputLabel}>файлов/день</Text>
              </View>
              <View style={styles.limitRow}>
                {LIMIT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.limitBtn, dailyLimit === opt && styles.limitBtnActive]}
                    onPress={() => changeDailyLimit(opt)}
                  >
                    <Text style={[styles.limitTxt, dailyLimit === opt && styles.limitTxtActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>МЕДИАТЕКА</Text>
          <TouchableOpacity style={styles.row} onPress={onAllMedia}>
            <Text style={styles.rowIcon}>🗂</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Все медиа</Text>
              <Text style={styles.rowDesc}>Все активные файлы в сейфе</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={onArchive}>
            <Text style={styles.rowIcon}>📦</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Архив</Text>
              <Text style={styles.rowDesc}>Файлы не в подборке, хранятся бессрочно</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={onTrash}>
            <Text style={styles.rowIcon}>🗑</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Корзина</Text>
              <Text style={styles.rowDesc}>Автоочистка через 30 дней</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>БЕЗОПАСНОСТЬ</Text>
          {vaultMode === 'real' && (
            <TouchableOpacity style={styles.row} onPress={onChangePin}>
              <Text style={styles.rowIcon}>🔑</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Сменить PIN-код</Text>
                <Text style={styles.rowDesc}>Изменить текущий PIN-код сейфа</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          {vaultMode === 'real' && (
            <TouchableOpacity style={styles.row} onPress={onSafeModeSetup}>
              <Text style={styles.rowIcon}>🎭</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Безопасный режим</Text>
                <Text style={styles.rowDesc}>Отдельное хранилище с другим PIN-кодом</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={onLock}>
            <Text style={styles.rowIcon}>🔒</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Заблокировать сейф</Text>
              <Text style={styles.rowDesc}>Выйти и потребовать PIN при следующем открытии</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ИНФОРМАЦИЯ</Text>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🛡</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Шифрование</Text>
              <Text style={styles.rowDesc}>AES-256-GCM, ключи в Android Keystore</Text>
            </View>
          </View>
          <View style={[styles.row, styles.rowNoBorder]}>
            <Text style={styles.rowIcon}>📵</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Полностью офлайн</Text>
              <Text style={styles.rowDesc}>Приложение никогда не обращается в интернет</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ОПАСНАЯ ЗОНА</Text>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={confirmDeleteAll}>
            <Text style={styles.rowIcon}>🗑</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: COLORS.danger }]}>Удалить все данные</Text>
              <Text style={styles.rowDesc}>Необратимо. Файлы из галереи не затрагиваются.</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.aboutBtn} onPress={showAbout}>
          <Text style={styles.aboutText}>О приложении</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  content: { padding: 16, gap: 20 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  section: { backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.subtext, paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowNoBorder: { borderBottomWidth: 0 },
  rowIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  rowDesc: { fontSize: 12, color: COLORS.subtext, lineHeight: 17 },
  aboutBtn: { alignItems: 'center', padding: 12 },
  aboutText: { color: COLORS.subtext, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 },
  limitInput: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    color: COLORS.text, fontSize: 16, fontWeight: '700', width: 80, textAlign: 'center',
  },
  limitInputLabel: { color: COLORS.subtext, fontSize: 13 },
  limitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  limitBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  limitBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  limitTxt: { color: COLORS.subtext, fontSize: 14, fontWeight: '600' },
  limitTxtActive: { color: '#fff' },
  chevron: { color: COLORS.subtext, fontSize: 20, fontWeight: '300' },
})
