export interface TeacherSummary {
  name: string
  slug: string
  title: string | null
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


export type TeacherWithSchedule = TeacherSummary & { schedule: ScheduleDay[] }

export interface NowPlaying {
  title: string
  artist: string
}
