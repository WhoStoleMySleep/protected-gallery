import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'
import { s } from '../i18n'

export interface SelectionAction {
  label: string
  danger?: boolean
  onPress: () => void
}

interface Props {
  count: number
  onCancel: () => void
  actions: SelectionAction[]
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.card, paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  side: { minWidth: 80 },
  actionsRow: { flexDirection: 'row', gap: 20, justifyContent: 'flex-end' },
  cancelTxt: { color: c.accent, fontSize: 15 },
  count: { color: c.text, fontSize: 14, fontWeight: '700' },
  actionTxt: { color: c.accent, fontSize: 15, fontWeight: '600' },
  actionDanger: { color: c.danger },
})

export const SelectionBar: React.FC<Props> = ({ count, onCancel, actions }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { bottom } = useSafeAreaInsets()

  const translateY = useRef(new Animated.Value(80)).current

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      damping: 16, stiffness: 300, mass: 0.8,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <View style={[styles.container, { paddingBottom: Math.max(bottom, 16) }]}>
        <Pressable onPress={onCancel} style={styles.side}>
          <Text style={styles.cancelTxt}>{s.selection.cancel}</Text>
        </Pressable>
        <Text style={styles.count}>{s.selection.selected(count)}</Text>
        <View style={[styles.side, styles.actionsRow]}>
          {actions.map(a => (
            <Pressable key={a.label} onPress={a.onPress}>
              <Text style={[styles.actionTxt, a.danger && styles.actionDanger]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Animated.View>
  )
}
