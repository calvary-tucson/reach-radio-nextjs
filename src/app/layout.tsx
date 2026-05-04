import { Suspense } from 'react'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { MediaBar } from '@/components/media-bar/MediaBar'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Reach Radio', template: '%s | Reach Radio' },
  description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
  metadataBase: new URL('https://reach-radio.com'),
}

async function MobileAppChrome() {
  const headersList = await headers()
  const isMobileApp = headersList.get('mobile-app') === 'true'
  if (!isMobileApp) return null
  return (
    <style>{`#site-header,#site-footer,#site-nav{display:none!important}`}</style>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-brand-purple)] text-white min-h-screen">
        <BridgeInit />
        <Suspense>
          <MobileAppChrome />
        </Suspense>
        <Header />
        <main>{children}</main>
        <Footer />
        <MobileNav />
        <MediaBar />
      </body>
    </html>
  )
}
