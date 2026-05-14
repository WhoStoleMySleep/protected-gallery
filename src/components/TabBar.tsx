import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainTab } from '../types'
import { COLORS } from '../theme'

interface Props {
  active: MainTab
  onSelect: (tab: MainTab) => void
}

const TABS: { id: MainTab; label: string; icon: string }[] = [
  { id: 'daily', label: 'Сегодня', icon: '✦' },
  { id: 'import', label: 'Импорт', icon: '+' },
  { id: 'settings', label: 'Настройки', icon: '⚙' },
]

export const TabBar: React.FC<Props> = ({ active, onSelect }) => (
  <SafeAreaView edges={['bottom']} style={styles.wrapper}>
    <View style={styles.bar}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tab}
          onPress={() => onSelect(tab.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.icon, active === tab.id && styles.iconActive]}>
            {tab.icon}
          </Text>
          <Text style={[styles.label, active === tab.id && styles.labelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </SafeAreaView>
)

const styles = StyleSheet.create({
  wrapper: { backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  bar: { flexDirection: 'row', height: 56 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { fontSize: 20, color: COLORS.subtext },
  iconActive: { color: COLORS.accent },
  label: { fontSize: 10, color: COLORS.subtext },
  labelActive: { color: COLORS.accent, fontWeight: '600' },
})
