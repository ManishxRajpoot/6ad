'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

type ThemeCtx = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)
const STORAGE_KEY = '6ad-admin-theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(t: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (t === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = t
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default 'auto'; will be hydrated from localStorage on mount
  const [theme, setThemeState] = useState<Theme>('auto')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  // On mount, read stored preference
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) || 'auto'
    setThemeState(stored)
  }, [])

  // Recompute resolved theme whenever theme changes OR system preference changes
  useEffect(() => {
    const compute = () => {
      const next = theme === 'auto' ? getSystemTheme() : theme
      setResolvedTheme(next)
      applyTheme(next)
    }
    compute()

    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => compute()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// Inline script content — runs before React hydrates to set the right class
// and prevent a white flash on dark-mode users.
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') || 'auto';
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`.trim()
