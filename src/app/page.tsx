import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RadioPlayer } from '@/components/home/RadioPlayer'
import { TodaySchedule } from '@/components/home/TodaySchedule'
import { RadioPlayerSkeleton } from '@/components/skeletons/RadioPlayerSkeleton'
import { ScheduleSkeleton } from '@/components/skeletons/ScheduleSkeleton'
import { RadioStationSchema } from '@/components/seo/RadioStationSchema'

export const metadata: Metadata = {
  title: 'Listen',
  description: 'Reach Radio features Bible teachings and Christian music. Listen online or on the air in Tucson at 106.7FM and 690AM.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <div className="px-4 md:px-8 pt-4 space-y-6 pb-32">
      <h1 className="sr-only">Reach Radio</h1>
      <RadioStationSchema />

      <Suspense fallback={<RadioPlayerSkeleton />}>
        <RadioPlayer />
      </Suspense>

      <section>
        <h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 mb-3 px-1">Playing Next</h2>
        <Suspense fallback={<ScheduleSkeleton />}>
          <TodaySchedule />
        </Suspense>
      </section>

    </div>
  )
}
