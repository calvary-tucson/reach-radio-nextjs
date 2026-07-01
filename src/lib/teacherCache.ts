import { sanityFetch } from '@/lib/sanity/client'
import { teacherNamesAndPhotosQuery } from '@/lib/sanity/queries'

interface TeacherEntry {
  name: string
  photo: string | null  // GROQ photo.asset->url returns null when asset is unset
}

export interface ArtistResolution {
  imageUrl: string | null
  resolvedArtist: string | null
}

let cachedTeachers: TeacherEntry[] = []
let cacheTimestamp = 0
// Two caching layers:
//   in-process (1h) — avoids per-poll Data Cache lookups on warm instances
//   sanityFetch 'use cache' (days) — persists across Vercel cold starts via Vercel Data Cache
// Days is appropriate: teacher photos rarely change.
const CACHE_TTL_MS = 60 * 60 * 1000

// Deduplicates concurrent cache-miss fetches on cold starts (multiple SSE connections opening simultaneously).
let pendingFetch: Promise<TeacherEntry[]> | null = null

async function getTeachers(): Promise<TeacherEntry[]> {
  if (Date.now() - cacheTimestamp < CACHE_TTL_MS && cachedTeachers.length > 0) {
    return cachedTeachers
  }
  if (pendingFetch) return pendingFetch
  pendingFetch = (async () => {
    try {
      const teachers = await sanityFetch<TeacherEntry[]>(
        teacherNamesAndPhotosQuery,
        {},
        { tags: ['teachers'] }
      )
      if (teachers && teachers.length > 0) {
        cachedTeachers = teachers
        cacheTimestamp = Date.now()
      }
    } catch {
      // Return stale cache on error rather than breaking SSE
    }
    pendingFetch = null
    return cachedTeachers
  })()
  return pendingFetch
}

// Bidirectional substring match — mirrors useNowPlaying.ts client logic exactly.
// "Dr. John MacArthur" matches teacher "John MacArthur" (artist includes teacher name).
function matches(artist: string, teacherName: string): boolean {
  const a = artist.toLowerCase()
  const t = teacherName.toLowerCase()
  return t.includes(a) || a.includes(t)
}

export async function resolveArtist(artist: string): Promise<ArtistResolution> {
  if (!artist) return { imageUrl: null, resolvedArtist: null }
  const teachers = await getTeachers()
  const match = teachers.find((t) => matches(artist, t.name))
  // No match at all — not a teacher program
  if (!match) return { imageUrl: null, resolvedArtist: null }
  // Matched teacher but photo not set in Sanity — still return the canonical name
  if (!match.photo) return { imageUrl: null, resolvedArtist: match.name }
  const sep = match.photo.includes('?') ? '&' : '?'
  return {
    // w=420&fm=jpg — width only, natural aspect ratio preserved.
    // iOS composites into a square with blur fill (squareWithBlurFill in AudioStreamingManager).
    imageUrl: `${match.photo}${sep}w=420&fm=jpg`,
    resolvedArtist: match.name,
  }
}
