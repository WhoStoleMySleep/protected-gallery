import React, { useState } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as LocalAuthentication from 'expo-local-authentication'
import { PinPad } from '../components/PinPad'
import { checkPinMode } from '../crypto/pin'
import type { VaultMode } from '../types'
import { COLORS } from '../theme'

interface Props {
  onUnlock: (mode: VaultMode) => void
  biometricsAvailable: boolean
}

export const PinEntryScreen: React.FC<Props> = ({ onUnlock, biometricsAvailable }) => {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const handlePin = async (pin: string) => {
    setLoading(true)
    try {
      const mode = await checkPinMode(pin)
      if (mode) {
        setError(null)
        onUnlock(mode)
      } else {
        const next = attempts + 1
        setAttempts(next)
        setError(next >= 5
          ? `Неверный PIN (${next} попыток). Попробуйте снова.`
          : 'Неверный PIN. Попробуйте снова.')
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
    if (result.success) onUnlock('real')
  }

  return (
    <SafeAreaView style={styles.container}>
      <PinPad
        title="Введите PIN-код"
        onComplete={handlePin}
        error={error}
      />

      {biometricsAvailable && (
        <TouchableOpacity
          style={styles.bioBtn}
          onPress={handleBiometrics}
          activeOpacity={1}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  bioBtn: {
    position: 'absolute',
    bottom: -16,
    left: -16,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
  },
})
