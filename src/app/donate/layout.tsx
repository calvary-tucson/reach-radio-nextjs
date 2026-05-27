import type { Metadata } from 'next'
import Breadcrumbs from '@/components/global/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/donate' },
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Home', url: '/' },
          { name: 'Donate', url: '/donate' },
        ]}
      />
      {children}
    </>
  )
}
