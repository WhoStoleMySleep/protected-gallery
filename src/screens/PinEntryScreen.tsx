import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as LocalAuthentication from 'expo-local-authentication'
import { PinPad } from '../components/PinPad'
import { verifyPin } from '../crypto/pin'
import { COLORS } from '../theme'

interface Props {
  onUnlock: () => void
  biometricsAvailable: boolean
}

export const PinEntryScreen: React.FC<Props> = ({ onUnlock, biometricsAvailable }) => {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const handlePin = async (pin: string) => {
    setLoading(true)
    try {
      const ok = await verifyPin(pin)
      if (ok) {
        setError(null)
        onUnlock()
      } else {
        const next = attempts + 1
        setAttempts(next)
        if (next >= 5) {
          setError(`Неверный PIN (${next} попыток). Попробуйте снова.`)
        } else {
          setError('Неверный PIN. Попробуйте снова.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBiometrics = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Разблокируйте сейф',
      cancelLabel: 'Отмена',
      fallbackLabel: 'Ввести PIN',
    })
    if (result.success) onUnlock()
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.logo}>🔒</Text>
      <PinPad
        title="Введите PIN-код"
        onComplete={handlePin}
        error={error}
      />
      {biometricsAvailable && (
        <TouchableOpacity style={styles.bioBtn} onPress={handleBiometrics}>
          <Text style={styles.bioText}>Войти по биометрии</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  logo: { textAlign: 'center', fontSize: 48, marginTop: 32 },
  bioBtn: {
    alignSelf: 'center', marginBottom: 32, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  bioText: { color: COLORS.subtextLight, fontSize: 14 },
})
