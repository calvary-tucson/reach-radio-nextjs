export interface DateWindow {
  /** First day to show (YYYY-MM-DD, inclusive, America/Phoenix). */
  startsOn?: string
  /** Last day to show (YYYY-MM-DD, inclusive, America/Phoenix). */
  expiresOn?: string
}

/** Today's date as YYYY-MM-DD in the station's timezone. */
export function todayInPhoenix(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date())
}

/** `today` is a YYYY-MM-DD string in the station's timezone. */
export function isInDateWindow(window: DateWindow, today: string): boolean {
  if (window.startsOn !== undefined && today < window.startsOn) return false
  if (window.expiresOn !== undefined && today > window.expiresOn) return false
  return true
}
