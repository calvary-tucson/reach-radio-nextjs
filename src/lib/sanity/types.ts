export interface TeacherSummary {
  name: string
  slug: string
  title: string
  photo: string | null
  lqip?: string
}

export interface ScheduleTime {
  startTime: string
  endTime: string
}

export interface ScheduleDay {
  day: string
  times: ScheduleTime[]
}

export interface TeacherDetail extends TeacherSummary {
  subtitle: string | null
  links: { title: string; url: string }[]
  schedule: ScheduleDay[]
}

export interface ScheduleTeacher {
  name: string
  slug: string
  title: string
  photo: string
  time: string
  startTime: string
  endTime: string
}

export type TeacherWithSchedule = TeacherSummary & { schedule: ScheduleDay[] }

export interface NowPlaying {
  title: string
  artist: string
}
