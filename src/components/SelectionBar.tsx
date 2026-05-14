import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../theme'

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

export const SelectionBar: React.FC<Props> = ({ count, onCancel, actions }) => {
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  side: { minWidth: 80 },
  actionsRow: { flexDirection: 'row', gap: 20, justifyContent: 'flex-end' },
  cancelTxt: { color: COLORS.accent, fontSize: 15 },
  count: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  actionTxt: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
  actionDanger: { color: COLORS.danger },
})
