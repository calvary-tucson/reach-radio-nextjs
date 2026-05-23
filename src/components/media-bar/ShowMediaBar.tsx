'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

export function ShowMediaBar() {
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)
  useEffect(() => {
    setShowMediaBar(true)
  }, [setShowMediaBar])
  return null
}
