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
  *[_type == "teacher" && defined(slug.current)] { "slug": slug.current }
`

export const teacherSlugsWithDatesQuery = `
  *[_type == "teacher" && defined(slug.current)] { "slug": slug.current, "updatedAt": _updatedAt }
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
    "lqip": photo.asset->metadata.lqip,
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
    siteKeywords,
    "siteIconURL": siteIconLight.asset->url,
    "siteIconURLDark": siteIconDark.asset->url,
    twitterHandle,
    facebookPage
  }
`

export const highlightedTeachersQuery = `
  *[_type == "teacher" && slug.current in $slugs] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip
  }
`

export const APP_SETTINGS_ID = 'a2939b52-e844-45f4-ba97-c335991cea4b'

export const appSettingsQuery = `
  *[_type == "appSettings" && _id == $id][0] { radioAudioURL }
`
