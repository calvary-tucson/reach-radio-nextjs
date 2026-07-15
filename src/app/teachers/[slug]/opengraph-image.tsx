import { ImageResponse } from 'next/og'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, teacherSlugsQuery } from '@/lib/sanity/queries'

export const alt = 'Teacher on Reach Radio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function generateStaticParams() {
  try {
    const slugs = await sanityFetch<{ slug: string }[]>(
      teacherSlugsQuery,
      {},
      { tags: ['teachers'] }
    )
    return slugs.map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

const BG = 'linear-gradient(135deg, #1e1040 0%, #2D1B69 50%, #1a1040 100%)'
const GREEN = '#22C55E'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const teacher = await sanityFetch<{
    name: string
    title: string | null
    photo: string | null
  } | null>(teacherDetailQuery, { slug }, { tags: ['teachers'] }).catch(() => null)

  if (!teacher) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%', height: '100%', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: BG, fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ color: 'white', fontSize: 72, fontWeight: 800, letterSpacing: '-2px' }}>
            Reach Radio
          </div>
          <div style={{ color: GREEN, fontSize: 32, fontWeight: 600, marginTop: 16, letterSpacing: '2px' }}>
            TEACHER
          </div>
        </div>
      ),
      { ...size }
    )
  }

  const photoUrl = teacher.photo
    ? `${teacher.photo}?w=630&h=630&fit=crop&auto=format`
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          background: BG, fontFamily: 'system-ui, sans-serif',
        }}
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            style={{ width: 630, height: 630, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', padding: '40px 48px',
            position: 'relative',
          }}
        >
          <div style={{ color: 'white', fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
            {teacher.name}
          </div>
          {teacher.title && (
            <div
              style={{
                color: GREEN, fontSize: 24, fontWeight: 600,
                marginTop: 20, textTransform: 'uppercase', letterSpacing: '2px',
              }}
            >
              {teacher.title}
            </div>
          )}
          <div
            style={{
              position: 'absolute', bottom: 40, right: 48,
              color: 'rgba(255,255,255,0.45)', fontSize: 20,
            }}
          >
            Reach Radio
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
