'use client'

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

function getThemeCookie(): Theme | null {
  const m = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/)
  return m ? (m[1] as Theme) : null
}

function setThemeCookie(theme: Theme) {
  document.cookie = `theme=${theme};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
  html.classList.remove('light', 'dark')
  html.classList.add(resolved)
}

function ThemeInit({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const param = searchParams?.get('theme') ?? null
    if (param === 'light' || param === 'dark' || param === 'system') {
      setThemeCookie(param)
      setThemeState(param)
      applyTheme(param)
      return
    }

    const cookie = getThemeCookie()

    if (!cookie && document.body.dataset.app === 'true') {
      setThemeState('dark')
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add('dark')
      return
    }

    const effectiveTheme: Theme = cookie ?? 'dark'
    setThemeState(effectiveTheme)

    if (effectiveTheme !== 'system') {
      applyTheme(effectiveTheme)
      return
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyTheme('system')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [searchParams])

  const setTheme = useCallback((t: Theme) => {
    setThemeCookie(t)
    setThemeState(t)
    applyTheme(t)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ThemeInit>{children}</ThemeInit>
    </Suspense>
  )
}
