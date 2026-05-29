import { sanityFetch } from '@/lib/sanity/client'
import { teacherNamesAndPhotosQuery } from '@/lib/sanity/queries'

export async function GET(): Promise<Response> {
  try {
    const teachers = await sanityFetch<{ name: string; photo: string }[]>(
      teacherNamesAndPhotosQuery,
      {},
      { tags: ['teachers'] }
    )
    return Response.json(teachers)
  } catch {
    return Response.json([])
  }
}
