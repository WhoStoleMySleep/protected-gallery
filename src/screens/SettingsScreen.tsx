import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as LocalAuthentication from 'expo-local-authentication'
import { deletePin } from '../crypto/pin'
import { deleteMasterKey } from '../crypto/keys'
import { clearAllMeta } from '../storage/metadata'
import { clearVault } from '../storage/vault'
import { getDailyLimit, setDailyLimit, ThemeMode, getAutoLockTimeout, setAutoLockTimeout, AutoLockTimeout, getPanicShakeEnabled, setPanicShakeEnabled, getBiometricsEnabled, setBiometricsEnabled } from '../storage/settings'
import { clearDecryptedCache } from '../storage/decryptedCache'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

const LIMIT_OPTIONS = [10, 15, 20, 25, 30, 40, 50]
const AUTO_LOCK_OPTIONS: { value: AutoLockTimeout; label: string }[] = [
  { value: 0, label: 'Нет' },
  { value: 1, label: '1 мин' },
  { value: 2, label: '2 мин' },
  { value: 5, label: '5 мин' },
  { value: 10, label: '10 мин' },
  { value: 30, label: '30 мин' },
]

interface Props {
  onLock: () => void
  onResetComplete: () => void
  onChangePin: () => void
  onAllMedia: () => void
  onTrash: () => void
  onArchive: () => void
  onSafeModeSetup: () => void
  vaultMode: 'real' | 'safe'
  onAutoLockChange?: (t: AutoLockTimeout) => void
  onPanicShakeChange?: (enabled: boolean) => void
  onBiometricsChange?: (enabled: boolean) => void
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  content: { padding: 16, gap: 20 },
  title: { fontSize: 26, fontWeight: '800', color: c.text, marginBottom: 4 },
  section: { backgroundColor: c.card, borderRadius: 12, overflow: 'hidden' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: c.subtext, paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  rowNoBorder: { borderBottomWidth: 0 },
  rowIconWrap: { width: 32, alignItems: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 2 },
  rowDesc: { fontSize: 12, color: c.subtext, lineHeight: 17 },
  aboutBtn: { alignItems: 'center', padding: 12 },
  aboutText: { color: c.subtext, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 },
  limitInput: {
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    color: c.text, fontSize: 16, fontWeight: '700', width: 80, textAlign: 'center',
  },
  limitInputLabel: { color: c.subtext, fontSize: 13 },
  limitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  limitBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
  },
  limitBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
  limitTxt: { color: c.subtext, fontSize: 14, fontWeight: '600' },
  limitTxtActive: { color: '#fff' },
  themeSelector: { flexDirection: 'row', gap: 6 },
  themeBtn: { padding: 8, borderRadius: 8, backgroundColor: c.cardAlt },
  themeBtnActive: { backgroundColor: c.accent },
})

export const SettingsScreen: React.FC<Props> = ({ onLock, onResetComplete, onChangePin, onAllMedia, onTrash, onArchive, onSafeModeSetup, vaultMode, onAutoLockChange, onPanicShakeChange, onBiometricsChange }) => {
  const { colors, mode, setMode } = useTheme()
  const styles = makeStyles(colors)

  const [loading, setLoading] = useState(false)
  const [dailyLimit, setDailyLimitState] = useState(25)
  const [autoLock, setAutoLockState] = useState<AutoLockTimeout>(5)
  const [panicShake, setPanicShakeState] = useState(false)
  const [deviceHasBiometrics, setDeviceHasBiometrics] = useState(false)
  const [biometricsOn, setBiometricsOn] = useState(true)

  useEffect(() => {
    getDailyLimit().then(v => { setDailyLimitState(v); setLimitInput(String(v)) })
    getAutoLockTimeout().then(setAutoLockState)
    getPanicShakeEnabled().then(setPanicShakeState)
    getBiometricsEnabled().then(setBiometricsOn)
    LocalAuthentication.hasHardwareAsync().then(async (hw) => {
      if (!hw) return
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      setDeviceHasBiometrics(enrolled)
    })
  }, [])

  const changePanicShake = async (val: boolean) => {
    setPanicShakeState(val)
    await setPanicShakeEnabled(val)
    onPanicShakeChange?.(val)
  }

  const changeBiometrics = async (val: boolean) => {
    setBiometricsOn(val)
    await setBiometricsEnabled(val)
    onBiometricsChange?.(val)
  }

  const changeAutoLock = async (t: AutoLockTimeout) => {
    setAutoLockState(t)
    await setAutoLockTimeout(t)
    onAutoLockChange?.(t)
  }

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
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={{ color: colors.subtext, marginTop: 12 }}>Удаление данных...</Text>
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
                  placeholderTextColor={colors.subtext}
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
            <View style={styles.rowIconWrap}>
              <Ionicons name="grid-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Все медиа</Text>
              <Text style={styles.rowDesc}>Все активные файлы в сейфе</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={onArchive}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="archive-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Архив</Text>
              <Text style={styles.rowDesc}>Файлы не в подборке, хранятся бессрочно</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={onTrash}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="trash-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Корзина</Text>
              <Text style={styles.rowDesc}>Автоочистка через 30 дней</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>БЕЗОПАСНОСТЬ</Text>
          {vaultMode === 'real' && (
            <TouchableOpacity style={styles.row} onPress={onChangePin}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="key-outline" size={20} color={colors.subtext} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Сменить PIN-код</Text>
                <Text style={styles.rowDesc}>Изменить текущий PIN-код сейфа</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
          {vaultMode === 'real' && (
            <TouchableOpacity style={styles.row} onPress={onSafeModeSetup}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="shield-half-outline" size={20} color={colors.subtext} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Безопасный режим</Text>
                <Text style={styles.rowDesc}>Отдельное хранилище с другим PIN-кодом</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
          {deviceHasBiometrics && (
            <View style={styles.row}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="finger-print-outline" size={20} color={colors.subtext} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Биометрия</Text>
                <Text style={styles.rowDesc}>Разблокировка по отпечатку или лицу</Text>
              </View>
              <Switch
                value={biometricsOn}
                onValueChange={changeBiometrics}
                trackColor={{ false: colors.border, true: colors.accentDim }}
                thumbColor={biometricsOn ? colors.accent : colors.subtext}
              />
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Блокировка встряской</Text>
              <Text style={styles.rowDesc}>Резко встряхните телефон, чтобы мгновенно заблокировать сейф</Text>
            </View>
            <Switch
              value={panicShake}
              onValueChange={changePanicShake}
              trackColor={{ false: colors.border, true: colors.accentDim }}
              thumbColor={panicShake ? colors.accent : colors.subtext}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="timer-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Автоблокировка</Text>
              <View style={styles.limitRow}>
                {AUTO_LOCK_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.limitBtn, autoLock === opt.value && styles.limitBtnActive]}
                    onPress={() => changeAutoLock(opt.value)}
                  >
                    <Text style={[styles.limitTxt, autoLock === opt.value && styles.limitTxtActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={onLock}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Заблокировать сейф</Text>
              <Text style={styles.rowDesc}>Выйти и потребовать PIN при следующем открытии</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ВНЕШНИЙ ВИД</Text>
          <View style={[styles.row, styles.rowNoBorder]}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="contrast-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Тема</Text>
            </View>
            <View style={styles.themeSelector}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.themeBtn, mode === m && styles.themeBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Ionicons
                    name={m === 'system' ? 'phone-portrait-outline' : m === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={16}
                    color={mode === m ? '#fff' : colors.subtext}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ИНФОРМАЦИЯ</Text>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Шифрование</Text>
              <Text style={styles.rowDesc}>AES-256-GCM, ключи в Android Keystore</Text>
            </View>
          </View>
          <View style={[styles.row, styles.rowNoBorder]}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Полностью офлайн</Text>
              <Text style={styles.rowDesc}>Приложение никогда не обращается в интернет</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ОПАСНАЯ ЗОНА</Text>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={confirmDeleteAll}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.danger }]}>Удалить все данные</Text>
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
