declare global {
  interface Window {
    up: {
      history: { readonly location: string }
      reload: () => void
      navigate: (opts: { url: string }) => void
    }
  }
}

export function initUnpolyShim(router?: { push: (path: string) => void }): void {
  if (typeof window === 'undefined') return
  window.up = {
    history: {
      get location() {
        return window.location.pathname
      },
    },
    reload: () => window.location.reload(),
    navigate: (opts: { url: string }) => {
      if (router) {
        router.push(opts.url)
      } else {
        window.location.href = opts.url
      }
    },
  }
}
