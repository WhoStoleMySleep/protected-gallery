import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PinPad } from '../components/PinPad'
import { verifyPin, setupPin } from '../crypto/pin'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

interface Props {
  onComplete: () => void
  onCancel: () => void
}

type Step = 'verify' | 'newPin' | 'confirmNew'

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  cancel: { color: c.accent, fontSize: 16 },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
})

export const ChangePinScreen: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [step, setStep] = useState<Step>('verify')
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleVerify = async (pin: string) => {
    setLoading(true)
    try {
      const ok = await verifyPin(pin)
      if (ok) { setError(null); setStep('newPin') }
      else setError('Неверный PIN. Попробуйте снова.')
    } finally { setLoading(false) }
  }

  const handleNewPin = (pin: string) => {
    setNewPin(pin)
    setError(null)
    setStep('confirmNew')
  }

  const handleConfirmNew = async (pin: string) => {
    if (pin !== newPin) {
      setError('PIN не совпадает. Попробуйте снова.')
      setStep('newPin')
      setNewPin('')
      return
    }
    setLoading(true)
    try { await setupPin(pin); onComplete() }
    finally { setLoading(false) }
  }

  const titles: Record<Step, string> = {
    verify: 'Текущий PIN',
    newPin: 'Новый PIN',
    confirmNew: 'Повторите новый PIN',
  }
  const handlers = { verify: handleVerify, newPin: handleNewPin, confirmNew: handleConfirmNew }

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Отмена</Text></TouchableOpacity>
        <Text style={styles.title}>Смена PIN-кода</Text>
        <View style={{ width: 64 }} />
      </View>
      <PinPad title={titles[step]} onComplete={handlers[step]} error={error} />
    </SafeAreaView>
  )
}
