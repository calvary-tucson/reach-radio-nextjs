import { Suspense } from 'react'
import { ExternalLink } from 'lucide-react'
import { detectMobileApp } from '@/lib/utils/mobile-app'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'
import { DonatePageSkeleton } from '@/components/skeletons/DonatePageSkeleton'
import { getDonateCtaCopy, PUSHPAY_GIVING_URL } from '@/lib/donate/cta'

async function DonateContent() {
  const isMobileApp = await detectMobileApp()
  const { target, reassurance } = getDonateCtaCopy(isMobileApp)

  return (
    <>
      <ShowMediaBar />

      <div>
        <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight">
          Donate
        </h1>
        <p className="mt-2 text-sm md:text-base text-white/90 light:text-gray-600">
          Support Reach Radio — your gift keeps Bible teaching and gospel music on the air across Tucson.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TeacherInfoChip label="690AM · 106.7FM" variant="accent" />
        <TeacherInfoChip label="24/7" variant="accent" />
        <TeacherInfoChip label="Tucson, AZ" variant="accent" />
      </div>

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5 md:p-6">
        <h2 className="border-l-4 pl-3 font-bold text-sm border-l-[#84b84f] uppercase text-white light:text-gray-900 tracking-wide">
          Keeping the Gospel on the Air, 24/7
        </h2>
        <p className="mt-3 text-white/90 light:text-gray-600 text-sm leading-relaxed">
          Every gift keeps 690AM and 106.7FM on the air, reaching drivers, shut-ins, and anyone within
          range of a radio — no app, login, or subscription required. Your support covers the airtime,
          equipment, and staff that make that possible, day and night.
        </p>
      </div>

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5 md:p-6">
        <div className="flex items-center justify-center gap-1 h-5 mb-4 motion-safe:animate-pulse" aria-hidden="true">
          <span className="w-1 h-2 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-3.5 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-5 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-2.5 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-4 bg-[#84b84f] rounded-full" />
        </div>

        <div className="flex justify-center">
          <a
            href={PUSHPAY_GIVING_URL}
            rel="noopener noreferrer"
            aria-describedby="donate-cta-note"
            {...(target ? { target } : {})}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] font-bold rounded-full cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0a1305] opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0a1305]" />
            </span>
            Donate
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            {target && <span className="sr-only"> (opens in new tab)</span>}
          </a>
        </div>

        <p id="donate-cta-note" className="mt-3 text-center text-xs md:text-sm text-white/90 light:text-gray-500">
          {reassurance}
        </p>
      </div>
    </>
  )
}

export default function DonatePage() {
  return (
    <div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      <Suspense fallback={<DonatePageSkeleton />}>
        <DonateContent />
      </Suspense>
    </div>
  )
}
