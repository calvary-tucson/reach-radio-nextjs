import type { Metadata } from 'next'
import { ContactForm } from '@/components/about/ContactForm'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
}

export default function AboutPage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-white text-2xl font-bold mb-4">About Reach Radio</h1>
      <p className="text-white/70 mb-6">
        Reach Radio is a Christian radio station operating at 106.7FM and 690AM in Tucson, AZ,
        operated by Calvary Chapel of Tucson.
      </p>
      <h2 className="text-white font-semibold text-lg mb-4">Contact Us</h2>
      <ContactForm />
    </div>
  )
}
