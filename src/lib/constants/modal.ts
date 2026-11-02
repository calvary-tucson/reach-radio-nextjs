export const EXIT_DURATION = 280

// Longest of the two enter-animation branches below (mobile's 0.3s) — keep in
// sync with MODAL_ENTER_ANIMATION's durations.
export const ENTER_DURATION = 300

// Mobile (<sm): full-height bottom-sheet slide. Desktop (sm+): subtle dialog fade.
export const MODAL_ENTER_ANIMATION =
  'motion-safe:animate-[sheet-enter_0.3s_cubic-bezier(0.32,0.72,0,1)_both] sm:motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)]'
export const MODAL_EXIT_ANIMATION =
  'motion-safe:animate-[sheet-exit_0.28s_ease-in_forwards] sm:motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'

// In-panel push/pop slide between teacher states (PanelContentStage) and the
// Back button fade/slide. Keep in sync with the approved mock.
export const PANEL_PAGE_DURATION = 300
export const PANEL_PAGE_EASE = 'cubic-bezier(0.32,0.72,0,1)'
// How far the outgoing page drifts (percent of panel width) and how much it dims.
export const PANEL_PAGE_DRIFT = 28
export const PANEL_PAGE_DIM = 0.7
// If the route never arrives after a push/pop signal, give up and unlock.
export const PANEL_NAV_TIMEOUT = 2000
