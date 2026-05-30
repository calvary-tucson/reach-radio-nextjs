import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { MediaBar } from '@/components/media-bar/MediaBar'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { Header } from '@/components/layout/Header'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'
import { AudioProvider } from '@/components/AudioProvider'
import { SleepTimerProvider } from '@/components/SleepTimerProvider'
import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery, appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WebSiteSchema } from '@/components/seo/WebSiteSchema'
import { RadioStationSchema } from '@/components/seo/RadioStationSchema'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { FALLBACK_STREAM_URL, FALLBACK_OG_IMAGE } from '@/lib/constants'
import './globals.css'

export const viewport: Viewport = {
  viewportFit: 'cover',
}

const FALLBACK_DESCRIPTION = "Listen to Reach Radio, Tucson's Christian radio station featuring Bible teachings and gospel music on 106.7FM and 690AM."
const FALLBACK_KEYWORDS = 'Christian radio, Tucson, Bible teaching, gospel music, Reach Radio, 106.7FM, 690AM'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await sanityFetch<{
    siteTitle: string
    siteDescription?: string
    siteKeywords?: string[]
    siteIconURL?: string
    siteIconURLDark?: string
    twitterHandle?: string
  }>(siteSettingsQuery, {}, { tags: ['siteSettings'] }).catch(() => null)

  const siteTitle = siteSettings?.siteTitle ?? 'Reach Radio'
  const description = siteSettings?.siteDescription ?? FALLBACK_DESCRIPTION
  const keywords = siteSettings?.siteKeywords?.join(', ') ?? FALLBACK_KEYWORDS
  const lightIconURL = siteSettings?.siteIconURL
  const darkIconURL = siteSettings?.siteIconURLDark
  const twitterHandle = siteSettings?.twitterHandle

  const icons: Metadata['icons'] = lightIconURL || darkIconURL
    ? {
        icon: [
          ...(lightIconURL ? [{ url: lightIconURL, media: '(prefers-color-scheme: light)' }] : []),
          ...(darkIconURL ? [{ url: darkIconURL, media: '(prefers-color-scheme: dark)' }] : []),
        ],
        apple: lightIconURL
          ? [{ url: `${lightIconURL}?w=180&h=180&fit=crop&auto=format`, sizes: '180x180' }]
          : undefined,
      }
    : undefined

  return {
    title: { default: siteTitle, template: `%s | ${siteTitle}` },
    description,
    keywords,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reach.radio'),
    alternates: { canonical: '/' },
    robots: { index: true, follow: true },
    icons,
    openGraph: {
      type: 'website',
      siteName: siteTitle,
      title: siteTitle,
      description,
      url: 'https://reach.radio',
      locale: 'en_US',
      images: [{ url: FALLBACK_OG_IMAGE, width: 1024, height: 1024, alt: siteTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteTitle,
      description,
      ...(twitterHandle ? { site: twitterHandle, creator: twitterHandle } : {}),
    },
  }
}

function ChromeFallback() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-brand-purple)] border-b border-white/10 z-40"
      aria-hidden="true"
    />
  )
}

async function LayoutChrome({ modal }: { modal: React.ReactNode }) {
  const headersList = await headers()
  const cookieHeader = headersList.get('cookie') ?? ''
  const isMobileApp =
    headersList.get('mobile-app') === 'true' ||
    cookieHeader.split(';').some(c => c.trim() === 'mobile-app=true')

  const { radioAudioURL } = await sanityFetch<{ radioAudioURL: string }>(
    appSettingsQuery,
    { id: APP_SETTINGS_ID },
    { tags: ['appSettings'] }
  ).catch((err) => {
    console.error('Failed to fetch appSettings:', err)
    return { radioAudioURL: FALLBACK_STREAM_URL }
  })

  const streamUrl = radioAudioURL || FALLBACK_STREAM_URL

  return (
    <>
      <BridgeInit streamUrl={streamUrl} />
      {!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
      {!isMobileApp && <SleepTimerProvider />}
      {!isMobileApp && <Header />}
      {!isMobileApp && <MobileHeader />}
      {modal ? <div key="modal">{modal}</div> : null}
      {!isMobileApp && <Footer />}
      {!isMobileApp && <MobileNav />}
    </>
  )
}

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://cdn.sanity.io" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://formspree.io" />
      </head>
      <body className="bg-[var(--color-brand-purple)] text-white min-h-screen light:bg-white light:text-gray-900 pb-[152px]">
        <ThemeProvider>
          <TooltipProvider delayDuration={500}>
            <WebSiteSchema />
            <RadioStationSchema />
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded">
              Skip to main content
            </a>
            <Suspense fallback={<ChromeFallback />}>
              <LayoutChrome modal={modal} />
            </Suspense>
            <main id="main-content" className="pt-16">
              {children}
            </main>
            <MediaBar />
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
