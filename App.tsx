import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, AppState, AppStateStatus, Alert, PanResponder } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as LocalAuthentication from 'expo-local-authentication'
import { File, Directory, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'

import { pinExists } from './src/crypto/pin'
import { generateAndStoreMasterKey, loadMasterKey, masterKeyExists, deriveSubKey, loadSafeKey, generateAndStoreSafeKey } from './src/crypto/keys'
import { initMetadataStore, saveFile } from './src/storage/metadata'
import { ensureVaultDir, initVaultNamespace, purgeExpiredTrash, encryptAndSave, generateAndEncryptThumb } from './src/storage/vault'
import { getAutoLockTimeout, AutoLockTimeout, getPanicShakeEnabled, getBiometricsEnabled, getDailyEnabled, getSecureFlagEnabled } from './src/storage/settings'
import { applySecureFlag } from './src/native/secureFlag'
import { Accelerometer } from 'expo-sensors'

import { PinSetupScreen } from './src/screens/PinSetupScreen'
import { PinEntryScreen } from './src/screens/PinEntryScreen'
import { DailyScreen } from './src/screens/DailyScreen'
import { ImportScreen } from './src/screens/ImportScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { ViewerScreen } from './src/screens/ViewerScreen'
import { ChangePinScreen } from './src/screens/ChangePinScreen'
import { AllMediaScreen } from './src/screens/AllMediaScreen'
import { TrashScreen } from './src/screens/TrashScreen'
import { ArchiveScreen } from './src/screens/ArchiveScreen'
import { SafeModeSetupScreen } from './src/screens/SafeModeSetupScreen'
import { TabBar } from './src/components/TabBar'
import { ThemeProvider } from './src/context/ThemeContext'

import type { AppScreen, MainTab, ViewerReturn, VaultMode, VaultFile } from './src/types'
import { DARK_COLORS } from './src/theme'

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'loading' })
  const [fileKey, setFileKey] = useState<Uint8Array | null>(null)
  const [vaultMode, setVaultMode] = useState<VaultMode>('real')
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false)
  const [dailyEnabled, setDailyEnabledState] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoLockMs = useRef(5 * 60 * 1000)
  const fileKeyRef = useRef<Uint8Array | null>(null)
  const screenRef = useRef(screen)
  const [panicShakeEnabled, setPanicShakeEnabled] = useState(false)
  const lockRef = useRef<() => void>(() => {})
  const resetAutoLockRef = useRef<() => void>(() => {})
  const activityResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => { resetAutoLockRef.current(); return false },
    onMoveShouldSetPanResponderCapture: () => { resetAutoLockRef.current(); return false },
  }))
  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { fileKeyRef.current = fileKey }, [fileKey])

  useEffect(() => {
    init()
    getAutoLockTimeout().then(t => { autoLockMs.current = t === 0 ? 0 : t * 60 * 1000 })
    getPanicShakeEnabled().then(setPanicShakeEnabled)
    getBiometricsEnabled().then(setBiometricsEnabledState)
    getDailyEnabled().then(setDailyEnabledState)
    getSecureFlagEnabled().then(enabled => { if (!enabled) applySecureFlag(false) })
  }, [])

  // Shake-to-lock
  useEffect(() => {
    if (!panicShakeEnabled || !fileKey) return
    let count = 0
    Accelerometer.setUpdateInterval(80)
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z)
      if (mag > 2.5) {
        count++
        if (count >= 4) { lockRef.current(); count = 0 }
      } else {
        count = 0
      }
    })
    return () => sub.remove()
  }, [panicShakeEnabled, fileKey])

  const resetAutoLock = useCallback(() => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current)
    if (!autoLockMs.current) return
    const cur = screenRef.current
    if (cur.name === 'loading' || cur.name === 'pinSetup' || cur.name === 'pinEntry') return
    autoLockTimer.current = setTimeout(() => {
      autoLockTimer.current = null
      if (!fileKeyRef.current) return
      setScreen({ name: 'pinEntry' })
      setFileKey(null)
    }, autoLockMs.current)
  }, [])

  // Keep PanResponder capture handler pointing at latest resetAutoLock
  useEffect(() => { resetAutoLockRef.current = resetAutoLock }, [resetAutoLock])

  const checkPendingShares = useCallback(async () => {
    if (!fileKeyRef.current) return
    try {
      const cacheDir = new Directory(Paths.cache)
      const pendingDir = new Directory(cacheDir, 'pending_share')
      const metaFile = new File(pendingDir, 'meta.json')
      if (!metaFile.exists) return
      const json = await metaFile.text()
      const items: { path: string; mimeType: string; name: string }[] = JSON.parse(json)
      pendingDir.delete()
      if (!items.length) return

      const key = fileKeyRef.current
      let success = 0
      for (const item of items) {
        try {
          const id = randomUUID()
          const srcFile = new File(item.path)
          const [encUri, thumbPath] = await Promise.all([
            encryptAndSave(item.path, id, key),
            generateAndEncryptThumb(item.path, id, item.mimeType, key),
          ])
          const vaultFile: VaultFile = {
            id,
            originalName: item.name,
            mimeType: item.mimeType,
            size: srcFile.size || 0,
            importedAt: Date.now(),
            encryptedPath: encUri,
            thumbPath: thumbPath ?? undefined,
          }
          await saveFile(vaultFile)
          success++
        } catch {}
      }
      if (success > 0) {
        Alert.alert('Импорт завершён', `Добавлено ${success} файл${success === 1 ? '' : success < 5 ? 'а' : 'ов'} из галереи.`)
      }
    } catch {}
  }, [])

  const handleAppState = useCallback((state: AppStateStatus) => {
    if (state === 'active') {
      if (lockTimer.current) {
        clearTimeout(lockTimer.current)
        lockTimer.current = null
      }
      resetAutoLock()
      checkPendingShares()
      return
    }
    if (state === 'background') {
      if (autoLockTimer.current) { clearTimeout(autoLockTimer.current); autoLockTimer.current = null }
      const cur = screenRef.current
      if (cur.name === 'loading' || cur.name === 'pinSetup' || cur.name === 'pinEntry') return
      lockTimer.current = setTimeout(() => {
        setScreen({ name: 'pinEntry' })
        setFileKey(null)
        lockTimer.current = null
      }, 5000)
    }
  }, [resetAutoLock, checkPendingShares])

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [handleAppState])

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

  const unlock = async (mode: VaultMode = 'real') => {
    try {
      if (mode === 'safe') {
        let masterKey = await loadSafeKey()
        if (!masterKey) masterKey = await generateAndStoreSafeKey()
        const metaKey = await deriveSubKey(masterKey, 'metadata')
        initMetadataStore(metaKey, 'vault_safe')
        initVaultNamespace('vault_safe')
        ensureVaultDir()
        setFileKey(masterKey)
      } else {
        let masterKey = await loadMasterKey()
        if (!masterKey) masterKey = await generateAndStoreMasterKey()
        const metaKey = await deriveSubKey(masterKey, 'metadata')
        initMetadataStore(metaKey, 'vault')
        initVaultNamespace('vault')
        ensureVaultDir()
        setFileKey(masterKey)
        purgeExpiredTrash().catch(() => {})
      }
      setVaultMode(mode)
      setScreen({ name: 'daily' })
      setTimeout(() => { resetAutoLock(); checkPendingShares() }, 100)
    } catch (e: any) {
      setInitError(e?.message ?? String(e))
    }
  }

  const lock = useCallback(() => {
    if (autoLockTimer.current) { clearTimeout(autoLockTimer.current); autoLockTimer.current = null }
    setFileKey(null)
    setVaultMode('real')
    setScreen({ name: 'pinEntry' })
  }, [])

  useEffect(() => { lockRef.current = lock }, [lock])

  const openViewer = (fileIds: string[], index: number) => {
    const name = screen.name
    const returnTo: ViewerReturn =
      name === 'daily' || name === 'import' || name === 'settings' ||
      name === 'allMedia' || name === 'trash' || name === 'archive'
        ? name
        : 'daily'
    setScreen({ name: 'viewer', fileIds, initialIndex: index, returnTo })
  }

  const closeViewer = () => {
    const returnTo = screen.name === 'viewer' ? screen.returnTo : 'daily'
    setScreen({ name: returnTo } as AppScreen)
  }

  const currentTab = (): MainTab => {
    if (screen.name === 'daily' || screen.name === 'import' || screen.name === 'settings') return screen.name
    if (screen.name === 'viewer') {
      const r = screen.returnTo
      if (r === 'allMedia' || r === 'trash' || r === 'archive') return 'settings'
      return r
    }
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
        <PinEntryScreen onUnlock={unlock} biometricsAvailable={biometricsAvailable && biometricsEnabled} />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'changePin') {
    return (
      <SafeAreaProvider>
        <ChangePinScreen
          onComplete={() => setScreen({ name: 'settings' })}
          onCancel={() => setScreen({ name: 'settings' })}
        />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'allMedia' && fileKey) {
    return (
      <SafeAreaProvider>
        <AllMediaScreen
          fileKey={fileKey}
          onOpenViewer={openViewer}
          onBack={() => setScreen({ name: 'settings' })}
        />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'trash' && fileKey) {
    return (
      <SafeAreaProvider>
        <TrashScreen
          fileKey={fileKey}
          onOpenViewer={openViewer}
          onBack={() => setScreen({ name: 'settings' })}
        />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'archive' && fileKey) {
    return (
      <SafeAreaProvider>
        <ArchiveScreen
          fileKey={fileKey}
          onOpenViewer={openViewer}
          onBack={() => setScreen({ name: 'settings' })}
        />
      </SafeAreaProvider>
    )
  }

  if (screen.name === 'safeModeSetup') {
    return (
      <SafeAreaProvider>
        <SafeModeSetupScreen
          onComplete={() => setScreen({ name: 'settings' })}
          onCancel={() => setScreen({ name: 'settings' })}
        />
      </SafeAreaProvider>
    )
  }

  if (!fileKey) return <View style={styles.bg} />

  const tab = currentTab()

  return (
    <SafeAreaProvider>
      <View style={styles.bg} {...activityResponder.current.panHandlers}>
        <View style={styles.fill}>
          <View style={[styles.fill, tab !== 'daily' && styles.hidden]}>
            {dailyEnabled
              ? <DailyScreen fileKey={fileKey} onOpenViewer={openViewer} />
              : <AllMediaScreen fileKey={fileKey} onOpenViewer={openViewer} />
            }
          </View>
          <View style={[styles.fill, tab !== 'import' && styles.hidden]}>
            <ImportScreen fileKey={fileKey} onImportDone={() => setScreen({ name: 'daily' })} />
          </View>
          <View style={[styles.fill, tab !== 'settings' && styles.hidden]}>
            <SettingsScreen
              onLock={lock}
              onResetComplete={() => setScreen({ name: 'pinSetup' })}
              onChangePin={() => setScreen({ name: 'changePin' })}
              onAllMedia={() => setScreen({ name: 'allMedia' })}
              onTrash={() => setScreen({ name: 'trash' })}
              onArchive={() => setScreen({ name: 'archive' })}
              onSafeModeSetup={() => setScreen({ name: 'safeModeSetup' })}
              vaultMode={vaultMode}
              onAutoLockChange={(t: AutoLockTimeout) => {
                autoLockMs.current = t === 0 ? 0 : t * 60 * 1000
                resetAutoLock()
              }}
              onPanicShakeChange={setPanicShakeEnabled}
            onBiometricsChange={setBiometricsEnabledState}
            onDailyEnabledChange={setDailyEnabledState}
            />
          </View>
        </View>
        {screen.name !== 'viewer' && <TabBar active={tab} onSelect={t => setScreen({ name: t } as AppScreen)} dailyEnabled={dailyEnabled} />}

        {/* Вьюер поверх таб-лэйаута — при свайпе вниз виден грид позади */}
        {screen.name === 'viewer' && (
          <View style={StyleSheet.absoluteFill}>
            <ViewerScreen
              fileIds={screen.fileIds}
              initialIndex={screen.initialIndex}
              fileKey={fileKey}
              onClose={closeViewer}
            />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: DARK_COLORS.background },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  errorScreen: {
    flex: 1, backgroundColor: '#1a0000', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  errorTitle: { color: '#ff6b6b', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  errorMsg: { color: '#ffaaaa', fontSize: 13, fontFamily: 'monospace', textAlign: 'center', marginBottom: 16 },
  errorHint: { color: '#888', fontSize: 12 },
})
