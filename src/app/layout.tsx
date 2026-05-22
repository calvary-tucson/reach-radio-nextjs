import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { MediaBar } from '@/components/media-bar/MediaBar'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { Header } from '@/components/layout/Header'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'
import { AudioProvider } from '@/components/AudioProvider'
import { SleepTimerProvider } from '@/components/SleepTimerProvider'
import { sanityFetch } from '@/lib/sanity/client'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Reach Radio', template: '%s | Reach Radio' },
  description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
  metadataBase: new URL('https://reach.radio'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Reach Radio',
    title: 'Reach Radio',
    description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
    url: 'https://reach.radio',
  },
  twitter: {
    card: 'summary',
    title: 'Reach Radio',
    description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
  },
}

const FALLBACK_STREAM_URL = 'https://stream.radiojar.com/g4d600bv6p5tv'
const APP_SETTINGS_ID = 'a2939b52-e844-45f4-ba97-c335991cea4b'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const isMobileApp = headersList.get('mobile-app') === 'true'

  const { radioAudioURL } = await sanityFetch<{ radioAudioURL: string }>(
    `*[_type == "appSettings" && _id == $id][0]{ radioAudioURL }`,
    { id: APP_SETTINGS_ID },
    { tags: ['appSettings'] }
  ).catch((err) => {
    console.error('Failed to fetch appSettings:', err)
    return { radioAudioURL: FALLBACK_STREAM_URL }
  })

  const streamUrl = radioAudioURL || FALLBACK_STREAM_URL

  return (
    <html lang="en">
      <body className="bg-[var(--color-brand-purple)] text-white min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded">
          Skip to main content
        </a>
        <BridgeInit />
        {!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
        {!isMobileApp && <SleepTimerProvider />}
        {!isMobileApp && <Header />}
        {!isMobileApp && <MobileHeader />}
        <main id="main-content" className={!isMobileApp ? 'pt-16 pb-36' : ''}>{children}</main>
        {!isMobileApp && <Footer />}
        {!isMobileApp && <MobileNav />}
        <MediaBar />
      </body>
    </html>
  )
}
