'use client'

import { useState } from 'react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({ teachers, scheduleTeachers }: TeachersClientViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('teachers')

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-2xl font-bold">All Teachers</h2>
        <span className="text-white/50 text-sm">{teachers.length} teachers</span>
      </div>

      <div className="flex gap-1 mb-5 border-b border-white/10">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-[var(--color-brand-green)]'
                : 'text-white/50 border-transparent hover:text-white/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teachers.map((teacher, index) => (
            <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
          ))}
        </div>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
