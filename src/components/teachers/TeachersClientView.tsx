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
      <div role="tablist" className="flex gap-1 mb-5 border-b border-white/7 light:border-gray-200">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm md:text-sm font-semibold capitalize motion-safe:transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-[#84b84f] border-[#84b84f]'
                : 'text-white/55 light:text-gray-500 border-transparent hover:text-white/75'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <div id="panel-teachers" role="tabpanel" aria-labelledby="tab-teachers">
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[13px] md:text-sm font-bold uppercase tracking-[0.08em] text-white/55 light:text-gray-500">
              All Teachers
            </p>
            <span className="text-[12px] md:text-sm text-white/50 light:text-gray-400">{teachers.length}</span>
          </div>
          {teachers.length === 0 && (
            <p className="text-white/50 light:text-gray-400 text-sm py-8 text-center">No teachers found.</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[9px] md:gap-3">
            {teachers.map((teacher, index) => (
              <TeacherCard
                key={teacher.slug}
                teacher={teacher}
                index={index}
                scheduleDays={scheduleDaysMap.get(teacher.slug)}
                onNavigate={() => openModal(teacher.name)}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div id="panel-schedule" role="tabpanel" aria-labelledby="tab-schedule">
          <ScheduleTabView scheduleTeachers={scheduleTeachers} />
        </div>
      )}
    </>
  )
}
