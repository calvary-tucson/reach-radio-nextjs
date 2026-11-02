'use client'

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { isTheme, pickTheme, resolveTheme, type Theme } from '@/lib/theme/resolve-theme'

export type { Theme }

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

const LIGHT_QUERY = '(prefers-color-scheme: light)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function applyTheme(theme: Theme) {
  const html = document.documentElement
  const resolved = resolveTheme(theme, window.matchMedia(LIGHT_QUERY).matches)
  html.classList.remove('light', 'dark')
  html.classList.add(resolved)
}

function ThemeInit({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const param = searchParams?.get('theme') ?? null
    if (isTheme(param)) setThemeCookie(param)

    const isNativeApp = document.documentElement.classList.contains('native-app')
    const chosen = pickTheme({ param, cookie: getThemeCookie(), isNativeApp })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- coordinates theme state with cookie/DOM mutations to prevent theme-flash on paint
    setThemeState(chosen)
    applyTheme(chosen)
    if (chosen !== 'system') return

    const mq = window.matchMedia(LIGHT_QUERY)
    const apply = () => applyTheme('system')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [searchParams])

  const setTheme = useCallback((t: Theme) => {
    setThemeCookie(t)
    const swap = () => {
      // flushSync so the new snapshot shows the new toggle state, not the old one
      flushSync(() => setThemeState(t))
      applyTheme(t)
    }
    const html = document.documentElement
    const reduce = window.matchMedia(REDUCED_MOTION_QUERY).matches
    if (reduce || typeof document.startViewTransition !== 'function') {
      swap()
      return
    }
    html.classList.add('theme-transition')
    const vt = document.startViewTransition(swap)
    // finished settles on skip/abort too, so the class cannot stick
    void vt.finished.finally(() => html.classList.remove('theme-transition'))
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
