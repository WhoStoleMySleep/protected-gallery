import React, { useState } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PinPad } from '../components/PinPad'
import { setupPin } from '../crypto/pin'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

interface Props {
  onComplete: () => void
}

type Step = 'enter' | 'confirm'

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
})

export const PinSetupScreen: React.FC<Props> = ({ onComplete }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [step, setStep] = useState<Step>('enter')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFirst = (pin: string) => {
    setFirstPin(pin)
    setStep('confirm')
    setError(null)
  }

  const handleConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setError('PIN не совпадает. Попробуйте снова.')
      setStep('enter')
      setFirstPin('')
      return
    }
    setLoading(true)
    try {
      await setupPin(pin)
      onComplete()
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {step === 'enter' ? (
        <PinPad
          title="Создайте PIN-код"
          onComplete={handleFirst}
          error={error}
        />
      ) : (
        <PinPad
          title="Повторите PIN-код"
          onComplete={handleConfirm}
          error={error}
        />
      )}
    </SafeAreaView>
  )
}
