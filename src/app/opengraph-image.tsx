import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Reach Radio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1040 0%, #2D1B69 50%, #1a1040 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: '-3px',
            lineHeight: 1,
          }}
        >
          Reach Radio
        </div>
        <div
          style={{
            color: '#22C55E',
            fontSize: 36,
            fontWeight: 600,
            marginTop: 24,
            letterSpacing: '2px',
          }}
        >
          106.7FM · 690AM
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 24,
            marginTop: 8,
          }}
        >
          Tucson, AZ
        </div>
      </div>
    ),
    { ...size }
  )
}
