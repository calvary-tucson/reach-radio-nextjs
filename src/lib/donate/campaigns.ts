import type { DateWindow } from '@/lib/date-window'

export interface DonateCampaign extends DateWindow {
  /** Unique, dated id (YYYY-MM-DD-slug), e.g. '2027-02-15-silent-drive'. Also used as the React key. */
  id: string
  title: string
  /** Paragraphs rendered in order. */
  paragraphs: readonly string[]
  /** Free-text dates, shown as a list: `{ label: 'Drive begins', when: 'Mon, Mar 8 · 6:00 AM' }`. */
  schedule?: readonly { label: string; when: string }[]
  /** Optional call to action. Paths starting with `/` are internal. */
  link?: { href: string; label: string }
}

/**
 * Campaign cards shown on /donate (e.g. the yearly Silent Drive). The first one in its date
 * window is shown; with none active the page is unchanged. Pair with a HOME_BANNERS entry
 * (src/lib/banners.ts) that uses the same dates.
 */
export const DONATE_CAMPAIGNS: readonly DonateCampaign[] = []
