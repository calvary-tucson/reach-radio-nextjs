export const teacherListQuery = `
  *[_type == "teacher"] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip
  }
`


export const teacherDetailQuery = `
  *[_type == "teacher" && slug.current == $slug][0] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    subtitle,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip,
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

export const teacherNamesAndPhotosQuery = `
  *[_type == "teacher"] {
    "name": name.first + " " + name.last,
    "photo": photo.asset->url
  }
`

export const siteSettingsQuery = `
  *[_type == "siteSettings"][0] {
    siteTitle,
    siteDescription,
    "siteIconURL": siteIconLight.asset->url,
    twitterHandle,
    facebookPage
  }
`
