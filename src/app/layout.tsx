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
import { NowPlayingProvider } from '@/components/NowPlayingProvider'
import { SleepTimerProvider } from '@/components/SleepTimerProvider'
import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery, appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WebSiteSchema } from '@/components/seo/WebSiteSchema'
import { RadioStationSchema } from '@/components/seo/RadioStationSchema'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { FALLBACK_STREAM_URL, FALLBACK_OG_IMAGE } from '@/lib/constants'
import { RouteAnnouncer } from '@/components/bridge/RouteAnnouncer'
import './globals.css'

export const viewport: Viewport = {
  viewportFit: 'cover',
  initialScale: 1,
  width: 'device-width',
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
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reach.radio',
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

async function detectMobileApp(): Promise<boolean> {
  const headersList = await headers()
  const cookieHeader = headersList.get('cookie') ?? ''
  return (
    headersList.get('mobile-app') === 'true' ||
    cookieHeader.split(';').some((c) => c.trim() === 'mobile-app=true')
  )
}

function ChromeFallback() {
  return (
    <div
      data-web-chrome=""
      className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-brand-purple)] light:bg-white border-b border-white/10 light:border-gray-200 z-40"
      aria-hidden="true"
    />
  )
}

async function LayoutChrome({ modal }: { modal: React.ReactNode }) {
  const isMobileApp = await detectMobileApp()

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
      <NowPlayingProvider />
      {!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
      <SleepTimerProvider />
      {!isMobileApp && <Header />}
      {!isMobileApp && <MobileHeader />}
      {modal ? <div key="modal">{modal}</div> : null}
    </>
  )
}

async function LayoutFooter() {
  const isMobileApp = await detectMobileApp()
  if (isMobileApp) return null

  return (
    <>
      <Footer />
      <MobileNav />
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=(light|dark|system)/);var t=m?m[1]:'dark';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.classList.add(r);}catch(e){}try{if(window.inNativeApp||document.cookie.indexOf('mobile-app=true')>=0){document.documentElement.classList.add('native-app');}}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://cdn.sanity.io" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://formspree.io" />
      </head>
      <body className="bg-[var(--color-brand-purple)] text-white min-h-screen light:bg-white light:text-gray-900 pb-[152px]">
        <ThemeProvider>
          <TooltipProvider delayDuration={500}>
            <WebSiteSchema />
            <RadioStationSchema />
            <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:px-4 focus-visible:py-2 focus-visible:bg-white focus-visible:text-black focus-visible:rounded">
              Skip to main content
            </a>
            <Suspense fallback={<ChromeFallback />}>
              <LayoutChrome modal={modal} />
            </Suspense>
            <main id="main-content" aria-label="Main content" className="pt-16 focus:outline-none" tabIndex={-1}>
              {children}
            </main>
            {/* No fallback: LayoutFooter returns null for native-app; suspending briefly is preferable to layout shift */}
            <Suspense>
              <LayoutFooter />
            </Suspense>
            <MediaBar />
            <Toaster richColors position="top-center" />
            <RouteAnnouncer />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
