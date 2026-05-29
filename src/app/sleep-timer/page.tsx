import type { Metadata } from 'next'
import SleepTimerPage from './SleepTimerClient'
import Breadcrumbs from '@/components/global/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Sleep Timer',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Home', url: '/' },
          { name: 'Sleep Timer', url: '/sleep-timer' },
        ]}
      />
      <SleepTimerPage />
    </>
  )
}
