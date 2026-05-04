import type { Metadata } from 'next'
import { headers } from 'next/headers'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const isMobileApp = headersList.get('mobile-app') === 'true'

  return (
    <html lang="en">
      <body className="bg-[var(--color-brand-purple)] text-white min-h-screen">
        <BridgeInit />
        {!isMobileApp && <Header />}
        <main>{children}</main>
        {!isMobileApp && <Footer />}
        {!isMobileApp && <MobileNav />}
        <MediaBar />
      </body>
    </html>
  )
}
