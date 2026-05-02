import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reach Radio',
  description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
