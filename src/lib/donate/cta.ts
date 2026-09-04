export interface DonateCtaCopy {
  /** '_blank' on web so the original tab survives; omitted in-app so the
   *  native WebView's own external-link interceptor (iOS's
   *  decidePolicyFor, Android's shouldOverrideUrlLoading) reliably catches
   *  this as a plain top-level navigation. */
  target?: '_blank'
  reassurance: string
}

const WEB_REASSURANCE =
  "Give once or set up recurring giving — you'll finish on PushPay's secure site, which opens in a new tab. Reach Radio stays right where you left it."

// No "stays right where you left it" claim here: Android's current WebView
// hand-off (a bare ACTION_VIEW intent, not Chrome Custom Tabs) fully
// backgrounds the app rather than staying in place. detectMobileApp()
// can't distinguish iOS from Android, so this copy has to stay accurate
// for the weaker case until the Android Custom Tabs fix ships and adopts.
const APP_REASSURANCE = "Give once or set up recurring giving on PushPay's secure site."

export function getDonateCtaCopy(isMobileApp: boolean): DonateCtaCopy {
  if (isMobileApp) {
    return { reassurance: APP_REASSURANCE }
  }
  return { target: '_blank', reassurance: WEB_REASSURANCE }
}
