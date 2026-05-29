import Link from 'next/link'
import React from 'react'

import { BackButton } from '@/components/global/BackButton'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

export interface BreadcrumbItemData {
  name: string
  /** Relative path, e.g. "/teachers". Absolute URLs for JSON-LD are constructed by BreadcrumbJsonLd. */
  url: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItemData[]
  /** "overlay" for inside hero sections, "standalone" for pages without a hero */
  variant?: 'overlay' | 'standalone'
  className?: string
}

export default function Breadcrumbs({
  items,
  variant = 'overlay',
  className,
}: BreadcrumbsProps) {
  if (items.length < 2) return null

  const ancestors = items.slice(0, -1)
  const current = items[items.length - 1]

  return (
    <div
      className={cn(
        variant === 'standalone' && 'relative px-[clamp(10px,3vw,30px)] pt-8 pb-4',
        className,
      )}
    >
      <BreadcrumbJsonLd items={items} />

      {/* Mobile back button — only in standalone variant (hero components own theirs) */}
      {variant === 'standalone' && <BackButton variant="mobile" />}

      {/* Desktop breadcrumb trail */}
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList className="rounded-lg bg-black/30 light:bg-gray-100 backdrop-blur-sm px-3 py-1.5 w-fit font-semibold gap-2">
          <BreadcrumbItem>
            <BackButton variant="desktop" />
          </BreadcrumbItem>
          {ancestors.map((crumb) => (
            <React.Fragment key={crumb.url}>
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="text-white/80 light:text-gray-600 underline-offset-4 hover:text-white light:hover:text-gray-900 hover:underline cursor-pointer">
                  <Link href={crumb.url}>{crumb.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-white/60 light:text-gray-400" />
            </React.Fragment>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage className="text-white light:text-gray-900">{current.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
