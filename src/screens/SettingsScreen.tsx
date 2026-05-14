import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { deletePin } from '../crypto/pin'
import { deleteMasterKey } from '../crypto/keys'
import { clearAllMeta, getAllFileIds } from '../storage/metadata'
import { clearVault } from '../storage/vault'
import { COLORS } from '../theme'

interface Props {
  onLock: () => void
  onResetComplete: () => void
}

export const SettingsScreen: React.FC<Props> = ({ onLock, onResetComplete }) => {
  const [loading, setLoading] = useState(false)

  const confirmDeleteAll = () => {
    Alert.alert(
      'Удалить всё?',
      'Все зашифрованные файлы и метаданные будут безвозвратно удалены. Это действие невозможно отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: deleteAll,
        },
      ]
    )
  }

  const deleteAll = async () => {
    setLoading(true)
    try {
      await clearAllMeta()
      await clearVault()
      await deletePin()
      await deleteMasterKey()
      onResetComplete()
    } finally {
      setLoading(false)
    }
  }

  const showAbout = () => {
    Alert.alert(
      'О приложении',
      'Личный зашифрованный медиасейф\n\nВерсия 1.0.0\n\nФайлы хранятся только локально на устройстве и зашифрованы алгоритмом AES-256-GCM.\n\nПриложение никогда не отправляет данные в интернет и не удаляет оригиналы из галереи.',
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={{ color: COLORS.subtext, marginTop: 12 }}>Удаление данных...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Настройки</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>БЕЗОПАСНОСТЬ</Text>
          <TouchableOpacity style={styles.row} onPress={onLock}>
            <Text style={styles.rowIcon}>🔒</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Заблокировать сейф</Text>
              <Text style={styles.rowDesc}>Выйти и потребовать PIN при следующем открытии</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ИНФОРМАЦИЯ</Text>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🛡</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Шифрование</Text>
              <Text style={styles.rowDesc}>AES-256-GCM, ключи в Android Keystore</Text>
            </View>
          </View>
          <View style={[styles.row, styles.rowNoBorder]}>
            <Text style={styles.rowIcon}>📵</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Полностью офлайн</Text>
              <Text style={styles.rowDesc}>Приложение никогда не обращается в интернет</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ОПАСНАЯ ЗОНА</Text>
          <TouchableOpacity style={[styles.row, styles.rowNoBorder]} onPress={confirmDeleteAll}>
            <Text style={styles.rowIcon}>🗑</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: COLORS.danger }]}>Удалить все данные</Text>
              <Text style={styles.rowDesc}>Необратимо. Файлы из галереи не затрагиваются.</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.aboutBtn} onPress={showAbout}>
          <Text style={styles.aboutText}>О приложении</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  content: { padding: 16, gap: 20 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  section: { backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.subtext, paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowNoBorder: { borderBottomWidth: 0 },
  rowIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  rowDesc: { fontSize: 12, color: COLORS.subtext, lineHeight: 17 },
  aboutBtn: { alignItems: 'center', padding: 12 },
  aboutText: { color: COLORS.subtext, fontSize: 13 },
})
