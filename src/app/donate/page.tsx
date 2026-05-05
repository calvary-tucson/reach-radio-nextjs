'use client'

import { useEffect, useRef, useState } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const DONATE_URL =
  'https://forms.ministryforms.net/viewForm.aspx?formid=32b9c82a-1472-4180-b023-73b42532b63e&direct-link=true&embed=false'
const EXPECTED_ORIGIN = 'https://forms.ministryforms.net'

export default function DonatePage() {
  const [loaded, setLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)

  useEffect(() => {
    return () => {
      setShowMediaBar(true)
    }
  }, [setShowMediaBar])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== EXPECTED_ORIGIN) return
      if (event.data?.type === 'donationFormInputFocus') {
        setShowMediaBar(false)
      } else if (event.data?.type === 'donationFormInputBlur') {
        setShowMediaBar(true)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setShowMediaBar])

  function handleLoad() {
    setLoaded(true)
    const attempts = { count: 0 }
    function trySend() {
      if (attempts.count >= 5) return
      attempts.count++
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'initParentInfo', origin: window.location.origin },
          EXPECTED_ORIGIN
        )
      } catch {}
      if (attempts.count < 5) setTimeout(trySend, 500)
    }
    trySend()
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-4">Support Reach Radio</h1>
      <p className="text-white/70 mb-6">Your generous support keeps Reach Radio on the air.</p>

      {!loaded && (
        <div className="animate-pulse flex flex-col gap-4 h-[800px] bg-black rounded p-4">
          <div className="h-[60px] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[90%] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[60%] bg-gray-700 rounded" />
          <div className="h-[150px] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[85%] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[75%] bg-gray-700 rounded" />
          <div className="h-[100px] bg-gray-700 rounded" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={DONATE_URL}
        title="Donation Form"
        onLoad={handleLoad}
        className={`w-full min-h-[1000px] border-0 ${loaded ? 'block' : 'hidden'}`}
      />
    </div>
  )
}
