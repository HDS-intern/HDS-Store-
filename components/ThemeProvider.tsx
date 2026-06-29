'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  applyTheme,
  DEFAULT_THEME,
  getThemeFromDocument,
  isAdminDashboard,
  readStoredTheme,
  type Theme,
  THEME_STORAGE_KEY,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore storage errors
  }
  applyTheme(theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    if (isAdminDashboard(pathname)) {
      setThemeState('dark')
      applyTheme('dark')
      return
    }

    const initial = getThemeFromDocument() || readStoredTheme()
    setThemeState(initial)
    persistTheme(initial)
  }, [pathname])

  const setTheme = useCallback((next: Theme) => {
    if (typeof window !== 'undefined' && isAdminDashboard(pathname)) {
      return
    }
    setThemeState(next)
    persistTheme(next)
  }, [pathname])

  const toggleTheme = useCallback(() => {
    if (typeof window !== 'undefined' && isAdminDashboard(pathname)) {
      return
    }
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      return next
    })
  }, [pathname])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
