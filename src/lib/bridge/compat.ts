declare global {
  interface Window {
    up: {
      history: { readonly location: string }
      reload: () => void
    }
  }
}

export function initUnpolyShim(): void {
  if (typeof window === 'undefined') return
  window.up = {
    history: {
      get location() {
        return window.location.pathname
      },
    },
    reload: () => window.location.reload(),
  }
}
