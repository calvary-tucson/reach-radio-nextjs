import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/donate' },
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
