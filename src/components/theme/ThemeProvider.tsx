'use client'

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { REDUCED_MOTION_QUERY } from '@/lib/hooks/usePrefersReducedMotion'
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

let latestTransition = 0
const noop = () => {}

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
    const resolved = resolveTheme(t, window.matchMedia(LIGHT_QUERY).matches)
    const reduce = window.matchMedia(REDUCED_MOTION_QUERY).matches
    // already showing this theme: update state/cookie only, nothing to animate
    if (
      reduce ||
      typeof document.startViewTransition !== 'function' ||
      html.classList.contains(resolved)
    ) {
      swap()
      return
    }
    const id = ++latestTransition
    // only the latest transition may clear the class, or an older one finishing would cut the newer animation
    const cleanup = () => {
      if (id === latestTransition) html.classList.remove('theme-transition')
    }
    html.classList.add('theme-transition')
    let vt: ViewTransition
    try {
      vt = document.startViewTransition(swap)
    } catch (e) {
      cleanup()
      throw e
    }
    // finished/ready/updateCallbackDone reject on skip or a throwing swap: handle all so none goes unhandled
    vt.finished.then(cleanup, cleanup)
    vt.ready.catch(noop)
    vt.updateCallbackDone.catch(noop)
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
