'use client'

import { useState, useMemo } from 'react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import { formatScheduleDays } from '@/lib/utils/time'
import { useModalStore } from '@/lib/stores/modal'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({ teachers, scheduleTeachers }: TeachersClientViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('teachers')
  const openModal = useModalStore((s) => s.openModal)

  const scheduleDaysMap = useMemo(
    () =>
      new Map<string, string>(
        scheduleTeachers.map((t) => [t.slug, formatScheduleDays(t.schedule.map((d) => d.day))])
      ),
    [scheduleTeachers]
  )

  return (
    <>
      <div role="tablist" className="flex gap-1 mb-5 border-b border-white/7">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm md:text-sm font-semibold capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-[#84b84f] border-[#84b84f]'
                : 'text-white/55 border-transparent hover:text-white/75'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <>
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[11px] md:text-sm font-bold uppercase tracking-[0.08em] text-white/55">
              All Teachers
            </p>
            <span className="text-[10px] md:text-sm text-white/50">{teachers.length}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[9px] md:gap-3">
            {teachers.map((teacher, index) => (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
              <div key={teacher.slug} onClick={() => openModal(teacher.name)}>
                <TeacherCard
                  teacher={teacher}
                  index={index}
                  scheduleDays={scheduleDaysMap.get(teacher.slug)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
