import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as LocalAuthentication from 'expo-local-authentication'

import { pinExists } from './src/crypto/pin'
import { generateAndStoreMasterKey, loadMasterKey, masterKeyExists, deriveSubKey } from './src/crypto/keys'
import { initMetadataStore } from './src/storage/metadata'
import { ensureVaultDir } from './src/storage/vault'

import { PinSetupScreen } from './src/screens/PinSetupScreen'
import { PinEntryScreen } from './src/screens/PinEntryScreen'
import { DailyScreen } from './src/screens/DailyScreen'
import { ImportScreen } from './src/screens/ImportScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { ViewerScreen } from './src/screens/ViewerScreen'
import { TabBar } from './src/components/TabBar'

import type { AppScreen, MainTab } from './src/types'
import { COLORS } from './src/theme'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'loading' })
  const [fileKey, setFileKey] = useState<Uint8Array | null>(null)
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [screen])

  const handleAppState = useCallback((state: AppStateStatus) => {
    if (state === 'active') {
      if (lockTimer.current) {
        clearTimeout(lockTimer.current)
        lockTimer.current = null
      }
      return
    }
    if (state === 'background' || state === 'inactive') {
      if (screen.name === 'loading' || screen.name === 'pinSetup' || screen.name === 'pinEntry') return
      // 5-секундная задержка — не блокируемся при открытии пикера/уведомлений
      lockTimer.current = setTimeout(() => {
        setScreen({ name: 'pinEntry' })
        setFileKey(null)
        lockTimer.current = null
      }, 5000)
    }
  }, [screen])

  const init = async () => {
    try {
      const [pinReady, hasBioHW] = await Promise.all([
        pinExists(),
        LocalAuthentication.hasHardwareAsync(),
      ])
      if (hasBioHW) {
        const enrolled = await LocalAuthentication.isEnrolledAsync()
        setBiometricsAvailable(enrolled)
      }
      if (!pinReady) {
        if (!(await masterKeyExists())) await generateAndStoreMasterKey()
        setScreen({ name: 'pinSetup' })
      } else {
        setScreen({ name: 'pinEntry' })
      }
    } catch (e: any) {
      setInitError(e?.message ?? String(e))
    }
  }

  const unlock = async () => {
    let masterKey = await loadMasterKey()
    if (!masterKey) masterKey = await generateAndStoreMasterKey()
    const metaKey = await deriveSubKey(masterKey, 'metadata')
    initMetadataStore(metaKey)
    ensureVaultDir()
    setFileKey(masterKey)
    setScreen({ name: 'daily' })
  }

  const lock = () => {
    setFileKey(null)
    setScreen({ name: 'pinEntry' })
  }

  const openViewer = (fileIds: string[], index: number) => {
    const returnTo: MainTab =
      screen.name === 'daily' || screen.name === 'import' || screen.name === 'settings'
        ? screen.name
        : 'daily'
    setScreen({ name: 'viewer', fileIds, initialIndex: index, returnTo })
  }

  const closeViewer = () => {
    const returnTo = screen.name === 'viewer' ? screen.returnTo : 'daily'
    setScreen({ name: returnTo } as AppScreen)
  }

  const currentTab = (): MainTab => {
    if (screen.name === 'daily' || screen.name === 'import' || screen.name === 'settings') return screen.name
    if (screen.name === 'viewer') return screen.returnTo
    return 'daily'
  }

  if (initError) {
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorTitle}>Ошибка запуска</Text>
        <Text style={styles.errorMsg}>{initError}</Text>
        <Text style={styles.errorHint}>Откройте консоль (j) для подробностей</Text>
      </View>
    )
  }

  if (screen.name === 'loading') return <View style={styles.bg} />

  if (screen.name === 'pinSetup') {
    return (
      <SafeAreaProvider>
        <PinSetupScreen onComplete={() => setScreen({ name: 'pinEntry' })} />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'pinEntry') {
    return (
      <SafeAreaProvider>
        <PinEntryScreen onUnlock={unlock} biometricsAvailable={biometricsAvailable} />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'viewer' && fileKey) {
    return (
      <SafeAreaProvider>
        <ViewerScreen
          fileIds={screen.fileIds}
          initialIndex={screen.initialIndex}
          fileKey={fileKey}
          onClose={closeViewer}
        />
      </SafeAreaProvider>
    )
  }

  if (!fileKey) return <View style={styles.bg} />

  const tab = currentTab()

  return (
    <SafeAreaProvider>
      <View style={styles.bg}>
        {/* Все вкладки всегда смонтированы — скрываем через display:none */}
        <View style={[styles.fill, tab !== 'daily' && styles.hidden]}>
          <DailyScreen fileKey={fileKey} onOpenViewer={openViewer} />
        </View>
        <View style={[styles.fill, tab !== 'import' && styles.hidden]}>
          <ImportScreen fileKey={fileKey} onImportDone={() => setScreen({ name: 'daily' })} />
        </View>
        <View style={[styles.fill, tab !== 'settings' && styles.hidden]}>
          <SettingsScreen onLock={lock} onResetComplete={() => setScreen({ name: 'pinSetup' })} />
        </View>
        <TabBar active={tab} onSelect={t => setScreen({ name: t } as AppScreen)} />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.background },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  errorScreen: {
    flex: 1, backgroundColor: '#1a0000', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  errorTitle: { color: '#ff6b6b', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  errorMsg: { color: '#ffaaaa', fontSize: 13, fontFamily: 'monospace', textAlign: 'center', marginBottom: 16 },
  errorHint: { color: '#888', fontSize: 12 },
})
