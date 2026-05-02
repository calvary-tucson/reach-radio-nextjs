export const teacherListQuery = `
  *[_type == "teacher"] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url
  }
`

export const teacherSearchQuery = `
  *[_type == "teacher" && (
    name.first match $query ||
    name.last match $query ||
    title match $query
  )] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url
  }
`

export const teacherDetailQuery = `
  *[_type == "teacher" && slug.current == $slug][0] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    subtitle,
    "photo": photo.asset->url,
    links[] { title, url },
    schedule[] {
      day,
      times[] { startTime, endTime }
    }
  }
`

export const teacherSlugsQuery = `
  *[_type == "teacher"] { "slug": slug.current }
`

export const scheduleQuery = `
  *[_type == "teacher" && count(schedule[day == $day]) > 0] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "schedule": schedule[day == $day] {
      day,
      times[] { startTime, endTime }
    }
  }
`

export const fullScheduleQuery = `
  *[_type == "teacher" && count(schedule) > 0] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    schedule[] {
      day,
      times[] { startTime, endTime }
    }
  }
`
