export const EXIT_DURATION = 280

// Longest of the two enter-animation branches below (mobile's 0.3s) — keep in
// sync with MODAL_ENTER_ANIMATION's durations.
export const ENTER_DURATION = 300

// Mobile (<sm): full-height bottom-sheet slide. Desktop (sm+): subtle dialog fade.
export const MODAL_ENTER_ANIMATION =
  'motion-safe:animate-[sheet-enter_0.3s_cubic-bezier(0.32,0.72,0,1)_both] sm:motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)]'
export const MODAL_EXIT_ANIMATION =
  'motion-safe:animate-[sheet-exit_0.28s_ease-in_forwards] sm:motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'
