export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark' || v === 'system'
}

interface PickInput {
  param: string | null
  cookie: Theme | null
  isNativeApp: boolean
}

/** Which theme setting applies: ?theme param, then (web only) saved cookie, else native=dark / web=system. */
export function pickTheme({ param, cookie, isNativeApp }: PickInput): Theme {
  if (isTheme(param)) return param
  if (isNativeApp) return 'dark'
  return cookie ?? 'system'
}

/** Dark unless the visitor's system explicitly asks for light ("no preference" stays dark). */
export function resolveTheme(theme: Theme, prefersLight: boolean): ResolvedTheme {
  if (theme === 'system') return prefersLight ? 'light' : 'dark'
  return theme
}
