import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { PinPad } from '../components/PinPad'
import { exportBackup, importBackup } from '../storage/backup'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'
import { s } from '../i18n'

interface Props {
  masterKey: Uint8Array
  onBack: () => void
  onImportComplete: () => void
}

type Step = 'idle' | 'exportPin' | 'exportConfirm' | 'exporting' | 'importPin' | 'importing'

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  loadingText: { color: c.subtext, marginTop: 12, fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerBtn: { color: c.accent, fontSize: 16, minWidth: 64 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  content: { padding: 16, gap: 20 },
  section: { backgroundColor: c.card, borderRadius: 12, overflow: 'hidden' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: c.subtext,
    paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIconWrap: { width: 32, alignItems: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 2 },
  rowDesc: { fontSize: 12, color: c.subtext, lineHeight: 17 },
  notice: { backgroundColor: c.cardAlt, borderRadius: 12, padding: 16 },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: c.subtext, marginBottom: 4 },
  noticeText: { fontSize: 12, color: c.subtext, lineHeight: 18 },
})

export const BackupScreen: React.FC<Props> = ({ masterKey, onBack, onImportComplete }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [exportPin, setExportPin] = useState('')
  const [pickedUri, setPickedUri] = useState<string | null>(null)

  const handleExportPin = (pin: string) => {
    setExportPin(pin)
    setError(null)
    setStep('exportConfirm')
  }

  const handleExportConfirm = async (pin: string) => {
    if (pin !== exportPin) {
      setError(s.backup.exportPinMismatch)
      setExportPin('')
      setStep('exportPin')
      return
    }
    setStep('exporting')
    try {
      const uri = await exportBackup(pin, masterKey)
      await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: s.backup.exportShareTitle })
    } catch (e: any) {
      Alert.alert(s.backup.exportError, e?.message ?? '')
    }
    setExportPin('')
    setStep('idle')
  }

  const pickAndImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
    if (result.canceled) return
    setPickedUri(result.assets[0].uri)
    setError(null)
    setStep('importPin')
  }

  const handleImportPress = () => {
    Alert.alert(s.backup.importWarnTitle, s.backup.importWarnMsg, [
      { text: s.backup.importWarnCancel, style: 'cancel' },
      { text: s.backup.importWarnConfirm, style: 'destructive', onPress: pickAndImport },
    ])
  }

  const handleImportPin = async (pin: string) => {
    if (!pickedUri) return
    setStep('importing')
    try {
      await importBackup(pickedUri, pin)
      Alert.alert(s.backup.importDoneTitle, s.backup.importDoneMsg, [
        { text: s.backup.importDoneBtn, onPress: onImportComplete },
      ])
    } catch (e: any) {
      const msg = e?.message === 'WRONG_PIN' ? s.backup.importErrorWrongPin : s.backup.importErrorGeneric
      setError(msg)
      setStep('importPin')
    }
  }

  if (step === 'exporting' || step === 'importing') {
    const label = step === 'exporting' ? s.backup.exporting : s.backup.importing
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>{label}</Text>
      </View>
    )
  }

  const renderHeader = (backLabel: string, backAction: () => void) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={backAction}>
        <Text style={styles.headerBtn}>{backLabel}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{s.backup.title}</Text>
      <View style={{ width: 64 }} />
    </View>
  )

  if (step === 'exportPin') {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(s.backup.cancel, () => setStep('idle'))}
        <PinPad title={s.backup.exportSetPin} onComplete={handleExportPin} error={error} />
      </SafeAreaView>
    )
  }

  if (step === 'exportConfirm') {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(s.backup.cancel, () => setStep('idle'))}
        <PinPad title={s.backup.exportConfirmPin} onComplete={handleExportConfirm} error={error} />
      </SafeAreaView>
    )
  }

  if (step === 'importPin') {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(s.backup.cancel, () => setStep('idle'))}
        <PinPad title={s.backup.importEnterPin} onComplete={handleImportPin} error={error} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader(s.backup.back, onBack)}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.backup.exportSection}</Text>
          <TouchableOpacity style={styles.row} onPress={() => setStep('exportPin')} activeOpacity={0.7}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.backup.exportTitle}</Text>
              <Text style={styles.rowDesc}>{s.backup.exportDesc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{s.backup.importSection}</Text>
          <TouchableOpacity style={styles.row} onPress={handleImportPress} activeOpacity={0.7}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.subtext} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{s.backup.importTitle}</Text>
              <Text style={styles.rowDesc}>{s.backup.importDesc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{s.backup.noticeTitle}</Text>
          <Text style={styles.noticeText}>{s.backup.noticeText}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
