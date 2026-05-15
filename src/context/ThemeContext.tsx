import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import { Colors, DARK_COLORS, LIGHT_COLORS } from '../theme'
import { ThemeMode, getThemeMode, setThemeMode } from '../storage/settings'

interface ThemeContextValue {
  colors: Colors
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: DARK_COLORS,
  mode: 'system',
  setMode: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    getThemeMode().then(setModeState)
  }, [])

  const resolvedDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark'
  const colors = resolvedDark ? DARK_COLORS : LIGHT_COLORS

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    setThemeMode(m)
  }

  return (
    <ThemeContext.Provider value={{ colors, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
