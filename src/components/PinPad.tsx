import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
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
const SPRING_PRESS = { damping: 10, stiffness: 500, mass: 0.6, useNativeDriver: true }
const SPRING_RELEASE = { damping: 12, stiffness: 400, mass: 0.6, useNativeDriver: true }

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: c.subtext, marginBottom: 32, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 20, justifyContent: 'center', minHeight: 10 },
  dash: { width: 18, height: 5, borderRadius: 3 },
  dashEmpty: { backgroundColor: c.border },
  dashFilled: { backgroundColor: c.accent },
  error: { color: c.danger, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 288, marginTop: 28, gap: 12 },
  keyWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  key: {
    width: 84, height: 84, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border,
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 26, fontWeight: '500', color: c.text, letterSpacing: 0.5 },
  keyBackspace: { fontSize: 22 },
  confirmBtn: {
    marginTop: 20, paddingHorizontal: 48, paddingVertical: 15, borderRadius: 14,
  },
  confirmActive: { backgroundColor: c.accent },
  confirmInactive: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  confirmTextInactive: { color: c.subtext },
})

interface PinKeyProps {
  label: string
  onPress: (key: string) => void
  style: object
  textStyle: object
  emptyStyle: object
  backspaceStyle: object
}

const PinKey: React.FC<PinKeyProps> = ({ label, onPress, style, textStyle, emptyStyle, backspaceStyle }) => {
  const scale = useRef(new Animated.Value(1)).current

  if (label === '') return <View style={[style, emptyStyle]} />

  return (
    <Pressable
      onPressIn={() => {
        Animated.spring(scale, { toValue: 0.87, ...SPRING_PRESS }).start()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, ...SPRING_RELEASE }).start()
      }}
      onPress={() => onPress(label)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={[textStyle, label === '⌫' && backspaceStyle]}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

export const PinPad: React.FC<Props> = ({
  title, subtitle, onComplete,
  maxLength = 16, minLength = 4,
  error, confirmLabel,
}) => {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [pin, setPin] = useState('')
  const shakeX = useRef(new Animated.Value(0)).current
  const dotsScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!error) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 11, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -11, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start()
    setPin('')
  }, [error])

  const press = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }
    if (pin.length >= maxLength) return
    Animated.sequence([
      Animated.spring(dotsScale, { toValue: 1.18, ...SPRING_PRESS }),
      Animated.spring(dotsScale, { toValue: 1, ...SPRING_RELEASE }),
    ]).start()
    setPin(p => p + key)
  }

  const canConfirm = pin.length >= minLength

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeX }] }]}>
        <Animated.View style={[styles.dots, { transform: [{ scale: dotsScale }] }]}>
          {Array.from({ length: Math.max(pin.length, 1) }).map((_, i) => (
            <View
              key={i}
              style={[styles.dash, i < pin.length ? styles.dashFilled : styles.dashEmpty]}
            />
          ))}
        </Animated.View>
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.keypad}>
        {KEYS.map((key, i) => (
          <PinKey
            key={i}
            label={key}
            onPress={press}
            style={styles.key}
            textStyle={styles.keyText}
            emptyStyle={styles.keyEmpty}
            backspaceStyle={styles.keyBackspace}
          />
        ))}
      </View>

      <Pressable
        style={[styles.confirmBtn, canConfirm ? styles.confirmActive : styles.confirmInactive]}
        onPress={() => {
          if (!canConfirm) return
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onComplete(pin)
          setTimeout(() => setPin(''), 100)
        }}
      >
        <Text style={[styles.confirmText, !canConfirm && styles.confirmTextInactive]}>
          {confirmLabel ?? s.pin.confirm}
        </Text>
      </Pressable>
    </View>
  )
}
