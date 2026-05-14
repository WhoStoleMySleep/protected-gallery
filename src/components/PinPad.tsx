import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native'
import { COLORS } from '../theme'

interface Props {
  title: string
  subtitle?: string
  onComplete: (pin: string) => void
  maxLength?: number
  minLength?: number
  error?: string | null
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export const PinPad: React.FC<Props> = ({
  title,
  subtitle,
  onComplete,
  maxLength = 6,
  minLength = 4,
  error,
}) => {
  const [pin, setPin] = useState('')
  const shakeAnim = new Animated.Value(0)

  useEffect(() => {
    if (error) {
      Vibration.vibrate(200)
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start()
      setPin('')
    }
  }, [error])

  const press = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }
    if (key === '') return
    const next = pin + key
    setPin(next)
    if (next.length >= maxLength) {
      onComplete(next)
      setTimeout(() => setPin(''), 100)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled]}
          />
        ))}
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.keypad}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.key, key === '' && styles.keyEmpty]}
            onPress={() => press(key)}
            disabled={key === ''}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, key === '⌫' && styles.keyBackspace]}>
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {pin.length >= minLength && pin.length < maxLength && (
        <TouchableOpacity style={styles.confirmBtn} onPress={() => {
          onComplete(pin)
          setTimeout(() => setPin(''), 100)
        }}>
          <Text style={styles.confirmText}>Подтвердить</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.subtext, marginBottom: 32, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginBottom: 16, marginTop: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.accent },
  dotFilled: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  error: { color: COLORS.danger, fontSize: 13, marginBottom: 8 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 280, marginTop: 24 },
  key: {
    width: 80, height: 80, alignItems: 'center', justifyContent: 'center',
    margin: 4, borderRadius: 40, backgroundColor: COLORS.card,
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '600', color: COLORS.text },
  keyBackspace: { fontSize: 20 },
  confirmBtn: {
    marginTop: 16, paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: COLORS.accent, borderRadius: 12,
  },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
