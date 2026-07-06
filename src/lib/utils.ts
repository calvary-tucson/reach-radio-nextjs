import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// iOS Safari/WKWebView auto-scrolls the nearest scrollable ancestor to
// "reveal" a focused element, even when it's already fully visible inside a
// position:fixed sheet -- that scroll races the keyboard's visualViewport
// resize and can desync the sheet's paint (see
// docs/bugs/ios-webview-keyboard-focus-scroll-desync.md). Use this instead
// of a bare .focus() for any programmatic focus inside a fixed-position
// overlay/sheet/dialog.
export function focusWithoutScroll(el: HTMLElement | null | undefined): void {
  el?.focus({ preventScroll: true })
}
