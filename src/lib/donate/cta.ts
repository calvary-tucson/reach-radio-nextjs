// Real Pushpay giving link, matching what's live on reach-radio-web (Astro).
// No Preconfigured Redirect is set up on the Pushpay side yet (Gaps #2-#3 in
// docs/superpowers/specs/2026-09-04-donate-page-link-out-design.md), so
// givers land on Pushpay's own default post-give page rather than
// /donate/thank-you until that's configured.
export const PUSHPAY_GIVING_URL = 'https://ppay.co/cehbNcmrSl4'

// Custom-scheme deep link back into the Reach Radio native app. Unconditional
// on the thank-you page (not gated on detectMobileApp()) — see
// docs/superpowers/specs/2026-09-05-post-donation-app-reopen-design.md for why.
export const REACHRADIO_DEEP_LINK_URL = 'reachradio://'

export interface DonateCtaCopy {
  /** '_blank' on web so the original tab survives; omitted in-app so the
   *  native WebView's own external-link interceptor (iOS's
   *  decidePolicyFor, Android's shouldOverrideUrlLoading) reliably catches
   *  this as a plain top-level navigation. */
  target?: '_blank'
  reassurance: string
}

const WEB_REASSURANCE =
  "Give once or set up recurring giving — you'll finish on Pushpay's secure site, which opens in a new tab. Reach Radio stays right where you left it."

// No "stays right where you left it" claim here: Android's current WebView
// hand-off (a bare ACTION_VIEW intent, not Chrome Custom Tabs) fully
// backgrounds the app rather than staying in place. detectMobileApp()
// can't distinguish iOS from Android, so this copy has to stay accurate
// for the weaker case until the Android Custom Tabs fix ships and adopts.
const APP_REASSURANCE = "Give once or set up recurring giving on Pushpay's secure site."

export function getDonateCtaCopy(isMobileApp: boolean): DonateCtaCopy {
  if (isMobileApp) {
    return { reassurance: APP_REASSURANCE }
  }
  return { target: '_blank', reassurance: WEB_REASSURANCE }
}
