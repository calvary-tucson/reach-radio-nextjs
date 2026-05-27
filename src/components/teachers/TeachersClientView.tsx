'use client'

import { useState, useMemo } from 'react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({ teachers, scheduleTeachers }: TeachersClientViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('teachers')

  const weeklyMinutesMap = useMemo(
    () =>
      new Map<string, number>(
        scheduleTeachers.map((t) => [t.slug, computeWeeklyMinutes(t.schedule)])
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
            className={`px-4 py-2 text-[12px] font-semibold capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-[#84b84f] border-[#84b84f]'
                : 'text-white/35 border-transparent hover:text-white/55'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <>
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
              All Teachers
            </p>
            <span className="text-[10px] text-white/25">{teachers.length}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[9px]">
            {teachers.map((teacher, index) => (
              <TeacherCard
                key={teacher.slug}
                teacher={teacher}
                index={index}
                weeklyMinutes={weeklyMinutesMap.get(teacher.slug)}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
