'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useMediaStore } from '@/lib/store/media-store'

declare global {
  interface Window {
    iFrameResize?: (options: Record<string, unknown>, selector: string) => void
  }
}

const DONATE_URL =
  'https://forms.ministryforms.net/viewForm.aspx?formid=32b9c82a-1472-4180-b023-73b42532b63e&direct-link=true&embed=false'
const EXPECTED_ORIGIN = 'https://forms.ministryforms.net'


export default function DonatePage() {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)

  useEffect(() => {
    setShowMediaBar(true)
    timeoutRef.current = setTimeout(() => setFailed(true), 10000)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
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
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setLoaded(true)
    window.iFrameResize?.(
      { log: false, heightCalculationMethod: 'bodyOffset' },
      '#donation-iframe'
    )
    let remaining = 5
    function trySend() {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'initParentInfo', origin: window.location.origin },
          EXPECTED_ORIGIN
        )
      } catch (err) {
        console.warn('postMessage to donation form failed:', err)
      }
      if (--remaining > 0) setTimeout(trySend, 500)
    }
    trySend()
  }

  function handleError() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFailed(true)
  }

  return (
    <div className="page-enter px-4 pt-5 pb-8">
      <h1 className="text-white text-2xl font-bold mb-4">Donate</h1>
      {failed ? (
        <div role="alert" className="text-white/70 text-sm py-8 text-center">
          <p>Unable to load the donation form.</p>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[var(--color-brand-green)] underline"
          >
            Open donation form in new tab
          </a>
        </div>
      ) : (
        <>
          {!loaded && (
            <div role="status" aria-label="Loading donation form..." className="animate-pulse flex flex-col gap-4 h-[900px] bg-black rounded p-4">
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
            id="donation-iframe"
            ref={iframeRef}
            src={DONATE_URL}
            title="Donation Form"
            onLoad={handleLoad}
            onError={handleError}
            sandbox="allow-scripts allow-forms allow-popups"
            className={`w-full min-h-[900px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${loaded ? 'block' : 'hidden'}`}
          />
        </>
      )}
      <Script src="/js/iFrameResizer.min.js" strategy="afterInteractive" />
    </div>
  )
}
