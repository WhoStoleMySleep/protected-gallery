import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { PinPad } from '../components/PinPad'
import { setupSafePin, safePinExists, deleteSafePin } from '../crypto/pin'
import { generateAndStoreSafeKey, deleteSafeKey } from '../crypto/keys'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

interface Props {
  onComplete: () => void
  onCancel: () => void
}

type Step = 'status' | 'newPin' | 'confirmPin'

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  cancel: { color: c.accent, fontSize: 16 },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 12 },
  desc: { fontSize: 14, color: c.subtext, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  primaryBtn: {
    backgroundColor: c.accent, paddingHorizontal: 40, paddingVertical: 14,
    borderRadius: 12, marginBottom: 12, width: '100%', alignItems: 'center',
  },
  primaryBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerBtn: {
    backgroundColor: c.card, paddingHorizontal: 40, paddingVertical: 14,
    borderRadius: 12, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: c.danger,
  },
  dangerBtnTxt: { color: c.danger, fontSize: 16, fontWeight: '600' },
})

export const SafeModeSetupScreen: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [step, setStep] = useState<Step>('status')
  const [isConfigured, setIsConfigured] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    safePinExists().then(exists => {
      setIsConfigured(exists)
      setLoading(false)
    })
  }, [])

  const handleNewPin = (pin: string) => {
    setNewPin(pin)
    setStep('confirmPin')
  }

  const handleConfirm = async (pin: string) => {
    if (pin !== newPin) {
      setNewPin('')
      setStep('newPin')
      return
    }
    setSaving(true)
    try {
      await setupSafePin(pin)
      await generateAndStoreSafeKey()
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const disable = () => {
    Alert.alert(
      'Отключить безопасный режим?',
      'Все файлы в безопасном хранилище будут безвозвратно удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отключить',
          style: 'destructive',
          onPress: async () => {
            setSaving(true)
            try {
              await deleteSafePin()
              await deleteSafeKey()
              onComplete()
            } finally {
              setSaving(false)
            }
          },
        },
      ],
    )
  }

  if (loading || saving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (step === 'newPin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('status')}>
            <Text style={styles.cancel}>Отмена</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Безопасный режим</Text>
          <View style={{ width: 64 }} />
        </View>
        <PinPad title="Новый PIN" onComplete={handleNewPin} />
      </SafeAreaView>
    )
  }

  if (step === 'confirmPin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setNewPin(''); setStep('newPin') }}>
            <Text style={styles.cancel}>Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Безопасный режим</Text>
          <View style={{ width: 64 }} />
        </View>
        <PinPad title="Повторите PIN" onComplete={handleConfirm} />
      </SafeAreaView>
    )
  }

  // step === 'status'
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>Отмена</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Безопасный режим</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.body}>
        <Ionicons name="shield-half-outline" size={56} color={colors.accent} style={styles.icon} />

        {!isConfigured ? (
          <>
            <Text style={styles.heading}>Не настроен</Text>
            <Text style={styles.desc}>
              Создайте отдельное хранилище с независимым PIN-кодом. При входе с этим кодом откроется безопасное хранилище — для отвлечения внимания.{'\n\n'}
              Смена PIN-кода и настройки безопасного режима в нём недоступны.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('newPin')}>
              <Text style={styles.primaryBtnTxt}>Настроить</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Активен</Text>
            <Text style={styles.desc}>
              Безопасное хранилище настроено. При входе с PIN-кодом безопасного режима откроется независимое хранилище.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('newPin')}>
              <Text style={styles.primaryBtnTxt}>Сменить PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={disable}>
              <Text style={styles.dangerBtnTxt}>Отключить</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}
