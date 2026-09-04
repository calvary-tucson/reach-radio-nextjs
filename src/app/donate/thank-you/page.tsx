import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { detectMobileApp } from '@/lib/utils/mobile-app'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { ListenButton } from './ListenButton'

export const metadata: Metadata = {
  title: 'Thank You',
  description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
  alternates: { canonical: '/donate/thank-you' },
  robots: { index: false },
  openGraph: {
    title: 'Thank You — Reach Radio',
    description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
    url: '/donate/thank-you',
  },
}

const FACEBOOK_URL = 'https://www.facebook.com/reachradiotucson'

export default async function ThankYouPage() {
  const isMobileApp = await detectMobileApp()

  return (
    <div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <ShowMediaBar />

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-6 md:p-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-white light:text-gray-900">
          Thank You
        </h1>
        <p className="mt-3 text-white/90 light:text-gray-600">
          Thank you — your gift helps keep Bible teaching and gospel music on the air across Tucson.
        </p>

        <div className="mt-8 flex flex-col md:flex-row gap-3 justify-center">
          <ListenButton />

          {isMobileApp && (
            <a
              href={FACEBOOK_URL}
              rel="noopener noreferrer"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-[#84b84f] text-white font-bold uppercase rounded-full cursor-pointer hover:bg-[#84b84f]/10 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Follow on Facebook
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
