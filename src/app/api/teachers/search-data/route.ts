import { NextResponse } from 'next/server'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'

export async function GET() {
  try {
    const data = await fetchAllTeacherData()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (error) {
    console.error('[search-data] fetchAllTeacherData failed', error)
    return NextResponse.json({ error: 'Failed to load teacher data' }, { status: 502 })
  }
}
