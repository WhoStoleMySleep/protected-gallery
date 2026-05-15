import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

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
  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottom, 16) }]}>
      <TouchableOpacity onPress={onCancel} style={styles.side}>
        <Text style={styles.cancelTxt}>Отмена</Text>
      </TouchableOpacity>
      <Text style={styles.count}>{count} выбрано</Text>
      <View style={[styles.side, styles.actionsRow]}>
        {actions.map(a => (
          <TouchableOpacity key={a.label} onPress={a.onPress}>
            <Text style={[styles.actionTxt, a.danger && styles.actionDanger]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
