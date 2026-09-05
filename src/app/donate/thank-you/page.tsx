import type { Metadata } from 'next'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { ListenButton } from './ListenButton'

export const metadata: Metadata = {
  title: { absolute: 'Thank You | Reach Radio' },
  description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
  alternates: { canonical: '/donate/thank-you' },
  robots: { index: false },
  openGraph: {
    title: 'Thank You — Reach Radio',
    description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
    url: '/donate/thank-you',
  },
}

export default function ThankYouPage() {
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

        <div className="mt-8 flex justify-center">
          <ListenButton />
        </div>
      </div>
    </div>
  )
}
