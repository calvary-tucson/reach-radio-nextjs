export type BannerIcon = 'radio-tower' | 'info' | 'calendar' | 'heart'

export interface SiteBanner {
  /** Unique, dated id (YYYY-MM-DD-slug). Dismissal is stored per id, so a new id re-shows the banner. */
  id: string
  /** Paragraphs rendered in order; the last one is emphasized as the sign-off when there are 2+. */
  paragraphs: readonly string[]
  /** Defaults to 'radio-tower'. A key, not a component, so config can cross the server/client boundary. */
  icon?: BannerIcon
  /** Optional call to action shown under the text. Paths starting with `/` are internal. */
  link?: { href: string; label: string }
  /** First day to show (YYYY-MM-DD, inclusive, America/Phoenix). */
  startsOn?: string
  /** Last day to show (YYYY-MM-DD, inclusive, America/Phoenix). */
  expiresOn?: string
}

/**
 * Banners for the top of the home page. The first one that is in its date window and not
 * dismissed is shown. Add new entries with a new dated id (e.g. each year's silent drive);
 * remove old ones when they no longer matter.
 */
export const HOME_BANNERS: readonly SiteBanner[] = [
  {
    id: '2026-11-11-signal-1067',
    paragraphs: [
      'We appreciate your patience and prayer as we try to figure out issues with our signal at 106.7FM. In the meantime, we encourage you to stream our app through your phone.',
      'Thank you and God Bless!',
    ],
  },
]

export const BANNER_DISMISSED_PREFIX = 'banner-dismissed:'

/** `today` is a YYYY-MM-DD string in the station's timezone. */
export function isBannerInWindow(banner: SiteBanner, today: string): boolean {
  if (banner.startsOn !== undefined && today < banner.startsOn) return false
  if (banner.expiresOn !== undefined && today > banner.expiresOn) return false
  return true
}
