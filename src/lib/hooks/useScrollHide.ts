import { useEffect, useRef } from 'react'

export function useScrollHide<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.style.transition = 'transform 0.5s, opacity 0.5s'
    let lastY = window.scrollY
    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (y > lastY) {
          el!.style.transform = 'translateY(-100%)'
          el!.style.opacity = '0'
        } else {
          el!.style.transform = 'translateY(0)'
          el!.style.opacity = '1'
        }
        lastY = y <= 0 ? 0 : y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return ref
}
