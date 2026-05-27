import Image from 'next/image'
import { getInitials } from '@/lib/teachers/initials'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type AvatarShape = 'circle' | 'rounded'

interface TeacherAvatarProps {
  name: string
  photo?: string | null
  lqip?: string | null
  /** Fixed pixel dimensions. Ignored when fill=true. */
  size: AvatarSize
  /** When true: positions absolute inset-0 to fill a relative parent. */
  fill?: boolean
  shape: AvatarShape
  /** Green ring + dark separator — used on detail page banner overlap. */
  ring?: boolean
  /** next/image sizes hint. Defaults to "{px}px". */
  sizes?: string
}

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24, sm: 38, md: 48, lg: 72, xl: 80,
}

const FONT_CLASS: Record<AvatarSize, string> = {
  xs: 'text-[8px]', sm: 'text-[11px]', md: 'text-[14px]', lg: 'text-[22px]', xl: 'text-[26px]',
}

const CIRCLE_RADIUS = 'rounded-full'
const ROUNDED_RADIUS: Record<AvatarSize, string> = {
  xs: 'rounded-[4px]', sm: 'rounded-[11px]', md: 'rounded-[12px]', lg: 'rounded-[16px]', xl: 'rounded-[18px]',
}

export function TeacherAvatar({
  name, photo, lqip, size, fill = false, shape, ring = false, sizes,
}: TeacherAvatarProps) {
  const px = SIZE_PX[size]
  const radiusClass = shape === 'circle' ? CIRCLE_RADIUS : ROUNDED_RADIUS[size]
  const fontClass = fill ? 'text-3xl' : FONT_CLASS[size]
  const imgSizes = sizes ?? `${px}px`

  const content = photo ? (
    <Image
      src={photo}
      alt={name}
      fill
      className="object-cover"
      placeholder={lqip ? 'blur' : 'empty'}
      blurDataURL={lqip ?? undefined}
      sizes={imgSizes}
    />
  ) : (
    <span className={`absolute inset-0 flex items-center justify-center ${fontClass} font-bold text-[rgba(132,184,79,0.8)]`}>
      {getInitials(name)}
    </span>
  )

  const base = `bg-gradient-to-br from-[#2d4a1a] to-[#1a2d0f] ${radiusClass} overflow-hidden`

  if (fill) {
    return (
      <div className={`absolute inset-0 ${base}`}>
        {content}
      </div>
    )
  }

  if (ring) {
    return (
      <div
        className={`relative flex-shrink-0 ${base}`}
        style={{
          width: px,
          height: px,
          boxShadow: '0 0 0 3px #111318, 0 0 0 5px rgba(132,184,79,0.35)',
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={`relative flex-shrink-0 ${base}`}
      style={{ width: px, height: px }}
    >
      {content}
    </div>
  )
}
