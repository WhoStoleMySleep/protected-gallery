import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'
import { s } from '../i18n'

interface Props {
  title: string
  subtitle?: string
  onComplete: (pin: string) => void
  maxLength?: number
  minLength?: number
  error?: string | null
  confirmLabel?: string
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: c.subtext, marginBottom: 32, textAlign: 'center' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16, marginTop: 16, justifyContent: 'center', maxWidth: 280 },
  dotEmpty: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: c.subtext },
  dotFilled: { width: 14, height: 14, borderRadius: 7, backgroundColor: c.accent },
  error: { color: c.danger, fontSize: 13, marginBottom: 8 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 280, marginTop: 24 },
  key: {
    width: 80, height: 80, alignItems: 'center', justifyContent: 'center',
    margin: 4, borderRadius: 40, backgroundColor: c.card,
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '600', color: c.text },
  keyBackspace: { fontSize: 20 },
  confirmBtn: {
    marginTop: 16, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
  },
  confirmActive: { backgroundColor: c.accent },
  confirmInactive: { backgroundColor: c.card },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  confirmTextInactive: { color: c.subtext },
})

export const PinPad: React.FC<Props> = ({
  title,
  subtitle,
  onComplete,
  maxLength = 16,
  minLength = 4,
  error,
  confirmLabel,
}) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

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
    setPin(p => p.length < maxLength ? p + key : p)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {pin.length === 0
          ? <View style={styles.dotEmpty} />
          : Array.from({ length: pin.length }).map((_, i) => (
              <View key={i} style={styles.dotFilled} />
            ))
        }
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

      <TouchableOpacity
        style={[styles.confirmBtn, pin.length >= minLength ? styles.confirmActive : styles.confirmInactive]}
        onPress={() => {
          if (pin.length < minLength) return
          onComplete(pin)
          setTimeout(() => setPin(''), 100)
        }}
        activeOpacity={pin.length >= minLength ? 0.7 : 1}
      >
        <Text style={[styles.confirmText, pin.length < minLength && styles.confirmTextInactive]}>
          {confirmLabel ?? s.pin.confirm}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
