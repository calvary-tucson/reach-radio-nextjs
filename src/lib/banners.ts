export interface SiteBanner {
  /** Unique, dated id (YYYY-MM-DD-slug). Dismissal is stored per id, so a new id re-shows the banner. */
  id: string
  /** Paragraphs rendered in order; the last one is emphasized as the sign-off. */
  paragraphs: readonly string[]
  /** Optional last day to show (YYYY-MM-DD, inclusive, America/Phoenix). */
  expiresOn?: string
}

/** The banner shown at the top of the home page. Set to `null` for none. */
export const HOME_BANNER: SiteBanner | null = {
  id: '2026-11-11-signal-1067',
  paragraphs: [
    'We appreciate your patience and prayer as we try to figure out issues with our signal at 106.7FM. In the meantime, we encourage you to stream our app through your phone.',
    'Thank you and God Bless!',
  ],
}

export const BANNER_DISMISSED_PREFIX = 'banner-dismissed:'

/** `today` is a YYYY-MM-DD string in the station's timezone. */
export function isBannerExpired(banner: SiteBanner, today: string): boolean {
  return banner.expiresOn !== undefined && today > banner.expiresOn
}
