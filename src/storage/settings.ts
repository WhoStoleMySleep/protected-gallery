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
