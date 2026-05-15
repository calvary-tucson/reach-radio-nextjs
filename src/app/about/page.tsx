import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ContactForm } from '@/components/about/ContactForm'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/about' },
}

export default async function AboutPage() {
  const headersList = await headers()
  const isMobileApp = headersList.get('mobile-app') === 'true'

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* Frequency hero */}
      <div className="grid md:grid-cols-2 rounded overflow-hidden">
        <div className="text-center p-5 bg-gradient-to-b from-green-600 to-green-700 flex flex-col justify-center items-center">
          <div className="text-5xl text-white font-bold">690AM</div>
          <div className="text-5xl text-white font-bold">106.7FM</div>
          <div className="text-lg text-white uppercase font-bold mt-1">On the air in Tucson, AZ</div>
        </div>
        <div className="p-6 bg-gradient-to-b from-gray-800 to-gray-900">
          <div className="border-l-4 pl-3 font-bold text-xl mb-3 border-l-green-500 uppercase text-white">
            Providing Solid Bible Teachings and Uplifting Worship 24/7
          </div>
          <p className="text-white/80">
            Reach Radio first went online in February 2016, and on the air in February 2017.
            Our goal is simple, to bring the life-saving message and hope of the gospel to
            as many as can hear via the Tucson radio airwaves.
          </p>
        </div>
      </div>

      {/* App download links — hidden in mobile app */}
      {!isMobileApp && (
        <div className="bg-gray-700/40 p-5 rounded">
          <h2 className="text-white text-2xl mb-4">Download App</h2>
          <div className="flex gap-3 flex-wrap">
            <a
              href="https://apps.apple.com/us/app/reach-radio-fm/id1246500077"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              App Store (iOS)
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.goodbarber.reachradio&hl=en_US&gl=US"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Google Play
            </a>
          </div>
        </div>
      )}

      {/* Contact form */}
      <div className="bg-gray-700/40 p-5 rounded">
        <h2 className="text-white text-2xl mb-2">Got Questions?</h2>
        <p className="text-white/60 text-sm mb-4">Send us a message and we will get back to you as soon as possible.</p>
        <ContactForm />
      </div>

      {/* Privacy policy */}
      <div className="bg-gray-700/40 p-5 rounded">
        <h2 className="text-white text-2xl mb-3">Privacy Policy</h2>
        <Link
          href="/about/privacy-policy"
          className="text-[var(--color-brand-green)] hover:underline text-sm"
        >
          Read our privacy policy →
        </Link>
      </div>
    </div>
  )
}
