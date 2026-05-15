import AsyncStorage from '@react-native-async-storage/async-storage'

const DAILY_LIMIT_KEY = 'vault:settings:dailyLimit'
export const DEFAULT_DAILY_LIMIT = 25

export const getDailyLimit = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(DAILY_LIMIT_KEY)
  return raw ? parseInt(raw, 10) : DEFAULT_DAILY_LIMIT
}

export const setDailyLimit = async (limit: number): Promise<void> => {
  await AsyncStorage.setItem(DAILY_LIMIT_KEY, String(limit))
}

const THEME_KEY = 'vault:settings:theme'
export type ThemeMode = 'light' | 'dark' | 'system'

export const getThemeMode = async (): Promise<ThemeMode> => {
  const raw = await AsyncStorage.getItem(THEME_KEY)
  return (raw as ThemeMode) ?? 'system'
}

export const setThemeMode = async (mode: ThemeMode): Promise<void> => {
  await AsyncStorage.setItem(THEME_KEY, mode)
}

const AUTO_LOCK_KEY = 'vault:settings:autoLock'
export type AutoLockTimeout = 0 | 1 | 2 | 5 | 10 | 30  // minutes; 0 = disabled

export const getAutoLockTimeout = async (): Promise<AutoLockTimeout> => {
  const raw = await AsyncStorage.getItem(AUTO_LOCK_KEY)
  return raw != null ? (parseInt(raw, 10) as AutoLockTimeout) : 5
}

export const setAutoLockTimeout = async (t: AutoLockTimeout): Promise<void> => {
  await AsyncStorage.setItem(AUTO_LOCK_KEY, String(t))
}

const PANIC_SHAKE_KEY = 'vault:settings:panicShake'

export const getPanicShakeEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(PANIC_SHAKE_KEY)
  return raw === 'true'
}

export const setPanicShakeEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(PANIC_SHAKE_KEY, String(enabled))
}

const BIOMETRICS_ENABLED_KEY = 'vault:settings:biometricsEnabled'

export const getBiometricsEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY)
  return raw === 'true'  // default: false
}

export const setBiometricsEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, String(enabled))
}

const DAILY_ENABLED_KEY = 'vault:settings:dailyEnabled'

export const getDailyEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(DAILY_ENABLED_KEY)
  return raw === 'true'  // default: false
}

export const setDailyEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(DAILY_ENABLED_KEY, String(enabled))
}

const SECURE_FLAG_KEY = 'vault:settings:secureFlag'

export const getSecureFlagEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(SECURE_FLAG_KEY)
  return raw !== 'false'  // default: true
}

export const setSecureFlagEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(SECURE_FLAG_KEY, String(enabled))
}
