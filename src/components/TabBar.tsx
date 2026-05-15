import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { MainTab } from '../types'
import { Colors } from '../theme'
import { useTheme } from '../context/ThemeContext'

interface Props {
  active: MainTab
  onSelect: (tab: MainTab) => void
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TABS: { id: MainTab; label: string; icon: IoniconName; iconActive: IoniconName }[] = [
  { id: 'daily', label: 'Сегодня', icon: 'images-outline', iconActive: 'images' },
  { id: 'import', label: 'Импорт', icon: 'cloud-download-outline', iconActive: 'cloud-download' },
  { id: 'settings', label: 'Настройки', icon: 'settings-outline', iconActive: 'settings' },
]

const makeStyles = (c: Colors) => StyleSheet.create({
  wrapper: { backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border },
  bar: { flexDirection: 'row', height: 56 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, color: c.subtext },
  labelActive: { color: c.accent, fontWeight: '600' },
})

export const TabBar: React.FC<Props> = ({ active, onSelect }) => {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrapper}>
      <View style={styles.bar}>
        {TABS.map(tab => {
          const isActive = active === tab.id
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onSelect(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
                color={isActive ? colors.accent : colors.subtext}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}
