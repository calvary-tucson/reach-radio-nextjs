import Image from 'next/image'
import * as React from 'react'

import { buildSanityImageUrl, type SanityImageLike } from '@/lib/sanity/image'

export interface SanityImageProps {
  src: SanityImageLike | string
  alt: string
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
  fill?: boolean
  sizes?: string
  priority?: boolean
  quality?: number
  'aria-hidden'?: boolean | 'true' | 'false'
}

function resolveImageUrl(src: SanityImageLike | string): string {
  return typeof src === 'string' ? src : buildSanityImageUrl(src)
}

function resolveStyle(
  style: React.CSSProperties | undefined,
  fill: boolean,
): React.CSSProperties | undefined {
  if (fill || !style) return style
  const hasWidth = style.width !== undefined
  const hasHeight = style.height !== undefined
  if (hasWidth && !hasHeight) return { ...style, height: 'auto' }
  if (hasHeight && !hasWidth) return { ...style, width: 'auto' }
  return style
}

function resolveBlurUrl(src: SanityImageLike | string): string {
  if (typeof src === 'string') {
    try {
      const url = new URL(src)
      url.searchParams.set('w', '20')
      url.searchParams.set('blur', '10')
      url.searchParams.set('q', '30')
      url.searchParams.set('auto', 'format')
      return url.toString()
    } catch {
      return src
    }
  }
  return buildSanityImageUrl(src, { w: 20 })
}

export const SanityImage: React.FC<SanityImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  style,
  fill = false,
  sizes,
  priority = false,
  quality,
  'aria-hidden': ariaHidden,
}) => {
  const resolvedSrc = resolveImageUrl(src)
  if (!resolvedSrc) return null

  const isSvg = resolvedSrc.split('?')[0].endsWith('.svg')
  const blurDataURL = isSvg ? undefined : resolveBlurUrl(src)
  const resolvedStyle = resolveStyle(style, fill)

  if (fill) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        aria-hidden={ariaHidden}
        className={className}
        style={resolvedStyle}
        priority={priority}
        quality={quality ?? 75}
        {...(isSvg ? { unoptimized: true } : { placeholder: 'blur', blurDataURL })}
        fill
        sizes={sizes ?? '100vw'}
      />
    )
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      aria-hidden={ariaHidden}
      className={className}
      style={resolvedStyle}
      priority={priority}
      quality={quality ?? 75}
      {...(isSvg ? { unoptimized: true } : { placeholder: 'blur', blurDataURL })}
      width={width ?? 1200}
      height={height ?? 800}
      sizes={sizes ?? '(max-width: 800px) 100vw, (max-width: 1200px) 50vw, 33vw'}
    />
  )
}

export default SanityImage
