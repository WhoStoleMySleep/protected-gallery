import React, { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native'
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

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [screen])

  const handleAppState = useCallback((state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      if (screen.name !== 'loading' && screen.name !== 'pinSetup' && screen.name !== 'pinEntry') {
        setScreen({ name: 'pinEntry' })
        setFileKey(null)
      }
    }
  }, [screen])

  const init = async () => {
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
  }

  const unlock = async () => {
    let masterKey = await loadMasterKey()
    if (!masterKey) masterKey = await generateAndStoreMasterKey()
    const metaKey = deriveSubKey(masterKey, 'metadata')
    initMetadataStore(metaKey)
    await ensureVaultDir()
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
        {tab === 'daily' && <DailyScreen fileKey={fileKey} onOpenViewer={openViewer} />}
        {tab === 'import' && <ImportScreen fileKey={fileKey} onImportDone={() => setScreen({ name: 'daily' })} />}
        {tab === 'settings' && <SettingsScreen onLock={lock} onResetComplete={() => setScreen({ name: 'pinSetup' })} />}
        <TabBar active={tab} onSelect={t => setScreen({ name: t } as AppScreen)} />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.background },
})
