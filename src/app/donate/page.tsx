'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

declare global {
  interface Window {
    iFrameResize?: (options: Record<string, unknown>, selector: string) => void
  }
  interface HTMLIFrameElement {
    iFrameResizer?: { close(): void }
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
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeRetry1Ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeRetry2Ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)

  useEffect(() => {
    setShowMediaBar(true)
    timeoutRef.current = setTimeout(() => setFailed(true), 10000)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
      if (resizeRetry1Ref.current) clearTimeout(resizeRetry1Ref.current)
      if (resizeRetry2Ref.current) clearTimeout(resizeRetry2Ref.current)
    }
  }, [setShowMediaBar])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== EXPECTED_ORIGIN) return
      if (event.data?.type === 'donationFormInputFocus') {
        setShowMediaBar(false)
        postMessageToNative({ showMobileNav: false, showMediaBar: false })
      } else if (event.data?.type === 'donationFormInputBlur') {
        setShowMediaBar(true)
        postMessageToNative({ showMobileNav: true, showMediaBar: true })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setShowMediaBar])

  function handleLoad() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
    if (resizeRetry1Ref.current) clearTimeout(resizeRetry1Ref.current)
    if (resizeRetry2Ref.current) clearTimeout(resizeRetry2Ref.current)
    setLoaded(true)
    const resizeOpts = { log: false, heightCalculationMethod: 'bodyOffset', warningTimeout: 0 }
    window.iFrameResize?.(resizeOpts, '#donation-iframe')
    // Form dynamically loads iFrameResizer.contentWindow after onLoad fires.
    // Delete the iFrameResizer property to bypass the "already setup" guard
    // (without calling close() which removes the iframe from the DOM).
    function retryResize() {
      const el = iframeRef.current
      if (!el || (el.style.height && el.style.height !== '0px')) return
      try { delete el.iFrameResizer } catch { /* non-configurable property — skip */ }
      window.iFrameResize?.(resizeOpts, '#donation-iframe')
    }
    resizeRetry1Ref.current = setTimeout(retryResize, 3000)
    resizeRetry2Ref.current = setTimeout(retryResize, 6000)
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
      if (--remaining > 0) {
        retryRef.current = setTimeout(trySend, 500)
      }
    }
    trySend()
  }

  function handleError() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFailed(true)
    setShowMediaBar(true)
  }

  return (
    <div className="page-enter px-4 py-6 pb-8">
      <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Donate</h1>
      {failed ? (
        <div role="alert" className="text-white/90 light:text-gray-500 text-sm py-8 text-center">
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
            <div role="status" aria-label="Loading donation form..." className="motion-safe:animate-pulse flex flex-col gap-4 min-h-[1300px] md:min-h-[1200px] bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-4">
              <div className="h-[60px] bg-white/5 light:bg-gray-200 rounded-xl" />
              <div className="h-[1.2em] w-[90%] bg-white/5 light:bg-gray-200 rounded-xl" />
              <div className="h-[1.2em] w-[60%] bg-white/5 light:bg-gray-200 rounded-xl" />
              <div className="h-[150px] bg-white/5 light:bg-gray-200 rounded-xl" />
              <div className="h-[1.2em] w-[85%] bg-white/5 light:bg-gray-200 rounded-xl" />
              <div className="h-[1.2em] w-[75%] bg-white/5 light:bg-gray-200 rounded-xl" />
              <div className="h-[100px] bg-white/5 light:bg-gray-200 rounded-xl" />
            </div>
          )}
          <iframe
            id="donation-iframe"
            ref={iframeRef}
            src={DONATE_URL}
            title="Donation Form"
            onLoad={handleLoad}
            onError={handleError}
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            className={`w-full min-h-[1300px] md:min-h-[1200px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${loaded ? 'block' : 'hidden'}`}
          />
        </>
      )}
      <Script src="/js/iFrameResizer.min.js" strategy="afterInteractive" />
    </div>
  )
}
