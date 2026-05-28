'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  teacher: TeacherWithSchedule | null
  open: boolean
  onClose: () => void
}

export function TeacherDetailPanel({ teacher, open, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setVisible(false)
    closeTimerRef.current = setTimeout(onClose, 250)
  }, [onClose])

  useEffect(() => setMounted(true), [])

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  if (!open || !mounted || !teacher) return null

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return createPortal(
    <>
      <div
        data-testid="teacher-detail-panel-backdrop"
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-[250ms] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${teacher.name} details`}
        className={`fixed right-0 top-0 bottom-0 z-[60] w-80 bg-[#0f1a0a] border-l border-white/[0.08] flex flex-col transition-transform duration-[250ms] ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-white text-xl font-bold">{teacher.name}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-center gap-4">
            <TeacherAvatar
              name={teacher.name}
              photo={teacher.photo}
              lqip={teacher.lqip ?? null}
              size="xl"
              shape="circle"
              sizes="80px"
            />
            {teacher.title && (
              <p className="text-white/70 text-sm">{teacher.title}</p>
            )}
          </div>

          {sortedSchedule.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase font-bold tracking-[0.1em] text-white/35 mb-3">
                This Week
              </h3>
              <ul className="space-y-2">
                {sortedSchedule.map((day) => (
                  <li key={day.day} className="flex gap-3">
                    <span className="text-white text-sm font-medium w-24 shrink-0">{day.day}</span>
                    <span className="text-white/55 text-sm">
                      {day.times.map((t) => `${t.startTime} – ${t.endTime}`).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`/teachers/${teacher.slug}`}
            onClick={handleClose}
            className="flex items-center justify-center w-full bg-[#1d2228] hover:bg-[#262d34] text-white rounded-xl py-4 text-sm font-semibold transition-colors cursor-pointer"
            aria-label={`View full profile for ${teacher.name}`}
          >
            View full profile →
          </Link>
        </div>
      </div>
    </>,
    document.body
  )
}
