import React, { useState } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as LocalAuthentication from 'expo-local-authentication'
import { PinPad } from '../components/PinPad'
import { checkPinMode } from '../crypto/pin'
import type { VaultMode } from '../types'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'
import { s } from '../i18n'

interface Props {
  onUnlock: (mode: VaultMode) => void
  biometricsAvailable: boolean
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
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

export const PinEntryScreen: React.FC<Props> = ({ onUnlock, biometricsAvailable }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

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
        setError(next >= 5 ? s.pin.wrongAttempts(next) : s.pin.wrong)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBiometrics = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: s.pin.bioPrompt,
      cancelLabel: s.pin.bioCancel,
      fallbackLabel: s.pin.bioFallback,
    })
    if (result.success) onUnlock('real')
  }

  return (
    <SafeAreaView style={styles.container}>
      <PinPad
        title={s.pin.enter}
        onComplete={handlePin}
        error={error}
        confirmLabel={s.pin.unlock}
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
