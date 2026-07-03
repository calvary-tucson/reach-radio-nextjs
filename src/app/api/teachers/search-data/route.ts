import { NextResponse } from 'next/server'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'

export async function GET() {
  const data = await fetchAllTeacherData()
  return NextResponse.json(data)
}
