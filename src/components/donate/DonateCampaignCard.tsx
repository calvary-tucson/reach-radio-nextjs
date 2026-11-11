'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Calendar, ExternalLink } from 'lucide-react'
import type { DonateCampaign } from '@/lib/donate/campaigns'
import { isInDateWindow, todayInPhoenix } from '@/lib/date-window'

interface DonateCampaignCardProps {
  campaigns: readonly DonateCampaign[]
}

const LINK_CLASS =
  'mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium text-[#84b84f] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none light:text-green-700'

const noopSubscribe = () => () => {}

export function DonateCampaignCard({ campaigns }: DonateCampaignCardProps) {
  // Date window is checked in the browser because /donate is cached; server snapshot is '' (nothing).
  const activeId = useSyncExternalStore(
    noopSubscribe,
    () => {
      const today = todayInPhoenix()
      return campaigns.find((c) => isInDateWindow(c, today))?.id ?? ''
    },
    () => '',
  )
  const campaign = campaigns.find((c) => c.id === activeId)
  if (!campaign) return null

  const { link } = campaign
  const titleId = `campaign-${campaign.id}`

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[18px] border border-[#84b84f]/25 bg-[#84b84f]/10 p-5 light:border-green-700/30 light:bg-green-50 md:p-6"
    >
      <h2
        id={titleId}
        className="border-l-4 border-l-[#84b84f] pl-3 text-sm font-bold uppercase tracking-wide text-white light:text-gray-900"
      >
        {campaign.title}
      </h2>
      {campaign.paragraphs.map((text) => (
        <p key={text} className="mt-3 text-sm leading-relaxed text-white/90 light:text-gray-900">
          {text}
        </p>
      ))}
      {campaign.schedule && campaign.schedule.length > 0 && (
        <dl className="mt-4 space-y-2 text-sm">
          {campaign.schedule.map((item) => (
            <div key={item.label} className="flex gap-3">
              <Calendar aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#84b84f] light:text-green-700" />
              <div className="flex flex-1 flex-wrap justify-between gap-x-4">
                <dt className="font-medium text-white light:text-gray-900">{item.label}</dt>
                <dd className="text-white/90 light:text-gray-700">{item.when}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
      {link &&
        (link.href.startsWith('/') ? (
          <Link href={link.href} className={LINK_CLASS}>
            {link.label}
          </Link>
        ) : (
          <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {link.label}
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ))}
    </section>
  )
}
