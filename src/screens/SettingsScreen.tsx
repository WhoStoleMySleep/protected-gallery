import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as LocalAuthentication from 'expo-local-authentication'
import { deletePin } from '../crypto/pin'
import { deleteMasterKey } from '../crypto/keys'
import { clearAllMeta } from '../storage/metadata'
import { clearVault } from '../storage/vault'
import { getDailyLimit, setDailyLimit, ThemeMode, getAutoLockTimeout, setAutoLockTimeout, AutoLockTimeout, getPanicShakeEnabled, setPanicShakeEnabled, getBiometricsEnabled, setBiometricsEnabled, getDailyEnabled, setDailyEnabled, getSecureFlagEnabled, setSecureFlagEnabled, getLanguageOverride, setLanguageOverride } from '../storage/settings'
import { applySecureFlag } from '../native/secureFlag'
import { s, applyLang, lang, Lang } from '../i18n'
import { clearDecryptedCache } from '../storage/decryptedCache'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

const LIMIT_OPTIONS = [10, 15, 20, 25, 30, 40, 50]
const AUTO_LOCK_VALUES: AutoLockTimeout[] = [0, 1, 2, 5, 10, 30]

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
  onDailyEnabledChange?: (enabled: boolean) => void
  onSecureFlagChange?: (enabled: boolean) => void
  onLangChange?: () => void
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
  rowDisabled: { opacity: 0.4 },
  themeSelector: { flexDirection: 'row', gap: 6 },
  themeBtn: { padding: 8, borderRadius: 8, backgroundColor: c.cardAlt },
  themeBtnActive: { backgroundColor: c.accent },
  langBtnTxt: { color: c.subtext, fontSize: 13, fontWeight: '700' },
})

export const SettingsScreen: React.FC<Props> = ({ onLock, onResetComplete, onChangePin, onAllMedia, onTrash, onArchive, onSafeModeSetup, vaultMode, onAutoLockChange, onPanicShakeChange, onBiometricsChange, onDailyEnabledChange, onSecureFlagChange, onLangChange }) => {
  const { colors, mode, setMode } = useTheme()
  const styles = makeStyles(colors)

  const [loading, setLoading] = useState(false)
  const [dailyLimit, setDailyLimitState] = useState(25)
  const [autoLock, setAutoLockState] = useState<AutoLockTimeout>(5)
  const [panicShake, setPanicShakeState] = useState(false)
  const [deviceHasBiometrics, setDeviceHasBiometrics] = useState(false)
  const [biometricsOn, setBiometricsOn] = useState(false)
  const [dailyOn, setDailyOn] = useState(false)
  const [secureFlagOn, setSecureFlagOn] = useState(true)
  const [currentLang, setCurrentLang] = useState<Lang>(lang)

  useEffect(() => {
    getDailyLimit().then(v => { setDailyLimitState(v); setLimitInput(String(v)) })
    getAutoLockTimeout().then(setAutoLockState)
    getPanicShakeEnabled().then(setPanicShakeState)
    getBiometricsEnabled().then(setBiometricsOn)
    getDailyEnabled().then(setDailyOn)
    getSecureFlagEnabled().then(setSecureFlagOn)
    getLanguageOverride().then(l => { if (l) setCurrentLang(l) })
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

  const changeDaily = async (val: boolean) => {
    setDailyOn(val)
    await setDailyEnabled(val)
    onDailyEnabledChange?.(val)
  }

  const changeLang = async (l: Lang) => {
    setCurrentLang(l)
    await setLanguageOverride(l)
    applyLang(l)
    onLangChange?.()
  }

  const changeSecureFlag = async (val: boolean) => {
    setSecureFlagOn(val)
    await setSecureFlagEnabled(val)
    applySecureFlag(val)
    onSecureFlagChange?.(val)
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
      s.settings.danger.deleteTitle,
      s.settings.danger.deleteMsg,
      [
        { text: s.settings.danger.deleteCancel, style: 'cancel' },
        { text: s.settings.danger.deleteConfirm, style: 'destructive', onPress: deleteAll },
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
    Alert.alert(s.settings.aboutTitle, s.settings.aboutMsg)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={{ color: colors.subtext, marginTop: 12 }}>{s.settings.deleting}</Text>
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{s.settings.title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.settings.sections.daily}</Text>
          <TouchableOpacity style={styles.row} onPress={() => changeDaily(!dailyOn)} activeOpacity={0.7}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="shuffle-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.daily.modeTitle}</Text>
              <Text style={styles.rowDesc}>{s.settings.daily.modeDesc}</Text>
            </View>
            <View pointerEvents="none">
              <Switch
                value={dailyOn}
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.accentDim }}
                thumbColor={dailyOn ? colors.accent : colors.subtext}
              />
            </View>
          </TouchableOpacity>
          <View style={[styles.row, styles.rowNoBorder, !dailyOn && styles.rowDisabled]}>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, !dailyOn && { color: colors.subtext }]}>{s.settings.daily.limitTitle}</Text>
              <Text style={styles.rowDesc}>{s.settings.daily.limitDesc}</Text>
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
                  editable={dailyOn}
                />
                <Text style={styles.limitInputLabel}>{s.settings.daily.limitUnit}</Text>
              </View>
              <View style={styles.limitRow}>
                {LIMIT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.limitBtn, dailyLimit === opt && styles.limitBtnActive]}
                    onPress={() => changeDailyLimit(opt)}
                    disabled={!dailyOn}
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
          <Text style={styles.sectionLabel}>{s.settings.sections.media}</Text>
          <TouchableOpacity style={styles.row} onPress={onAllMedia}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="grid-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.media.allMedia}</Text>
              <Text style={styles.rowDesc}>{s.settings.media.allMediaDesc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={onArchive}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="archive-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.media.archive}</Text>
              <Text style={styles.rowDesc}>{s.settings.media.archiveDesc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={onTrash}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="trash-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.media.trash}</Text>
              <Text style={styles.rowDesc}>{s.settings.media.trashDesc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.settings.sections.security}</Text>
          {vaultMode === 'real' && (
            <TouchableOpacity style={styles.row} onPress={onChangePin}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="key-outline" size={20} color={colors.subtext} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{s.settings.security.changePin}</Text>
                <Text style={styles.rowDesc}>{s.settings.security.changePinDesc}</Text>
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
                <Text style={styles.rowTitle}>{s.settings.security.safeMode}</Text>
                <Text style={styles.rowDesc}>{s.settings.security.safeModeDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
          {deviceHasBiometrics && (
            <TouchableOpacity style={styles.row} onPress={() => changeBiometrics(!biometricsOn)} activeOpacity={0.7}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="finger-print-outline" size={20} color={colors.subtext} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{s.settings.security.biometrics}</Text>
                <Text style={styles.rowDesc}>{s.settings.security.biometricsDesc}</Text>
              </View>
              <View pointerEvents="none">
                <Switch
                  value={biometricsOn}
                  onValueChange={() => {}}
                  trackColor={{ false: colors.border, true: colors.accentDim }}
                  thumbColor={biometricsOn ? colors.accent : colors.subtext}
                />
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.row} onPress={() => changeSecureFlag(!secureFlagOn)} activeOpacity={0.7}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="eye-off-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.security.secureScreen}</Text>
              <Text style={styles.rowDesc}>{s.settings.security.secureScreenDesc}</Text>
            </View>
            <View pointerEvents="none">
              <Switch
                value={secureFlagOn}
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.accentDim }}
                thumbColor={secureFlagOn ? colors.accent : colors.subtext}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => changePanicShake(!panicShake)} activeOpacity={0.7}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.security.panicShake}</Text>
              <Text style={styles.rowDesc}>{s.settings.security.panicShakeDesc}</Text>
            </View>
            <View pointerEvents="none">
              <Switch
                value={panicShake}
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.accentDim }}
                thumbColor={panicShake ? colors.accent : colors.subtext}
              />
            </View>
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="timer-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.security.autoLock}</Text>
              <View style={styles.limitRow}>
                {AUTO_LOCK_VALUES.map((val, i) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.limitBtn, autoLock === val && styles.limitBtnActive]}
                    onPress={() => changeAutoLock(val)}
                  >
                    <Text style={[styles.limitTxt, autoLock === val && styles.limitTxtActive]}>
                      {s.settings.security.autoLockOptions[i]}
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
              <Text style={styles.rowTitle}>{s.settings.security.lockNow}</Text>
              <Text style={styles.rowDesc}>{s.settings.security.lockNowDesc}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.settings.sections.appearance}</Text>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="contrast-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.appearance.theme}</Text>
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
          <View style={[styles.row, styles.rowNoBorder]}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="language-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Language</Text>
            </View>
            <View style={styles.themeSelector}>
              {(['ru', 'en'] as Lang[]).map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.themeBtn, currentLang === l && styles.themeBtnActive]}
                  onPress={() => changeLang(l)}
                >
                  <Text style={[styles.langBtnTxt, currentLang === l && { color: '#fff' }]}>
                    {l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.settings.sections.info}</Text>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.info.encryption}</Text>
              <Text style={styles.rowDesc}>{s.settings.info.encryptionDesc}</Text>
            </View>
          </View>
          <View style={[styles.row, styles.rowNoBorder]}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.settings.info.offline}</Text>
              <Text style={styles.rowDesc}>{s.settings.info.offlineDesc}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.settings.sections.danger}</Text>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={confirmDeleteAll}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.danger }]}>{s.settings.danger.deleteAll}</Text>
              <Text style={styles.rowDesc}>{s.settings.danger.deleteAllDesc}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.aboutBtn} onPress={showAbout}>
          <Text style={styles.aboutText}>{s.settings.about}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
