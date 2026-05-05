import type { Metadata } from 'next'
import SleepTimerPage from './SleepTimerClient'

export const metadata: Metadata = {
  title: 'Sleep Timer',
}

export default function Page() {
  return <SleepTimerPage />
}
