export interface SanityImageLike {
  asset?: { _ref?: string }
}

export interface ImageUrlParams {
  w?: number
  h?: number
  fit?: 'clip' | 'crop' | 'fill' | 'fillmax' | 'max' | 'scale' | 'min'
  dpr?: number
  autoFormat?: boolean
}

export function buildSanityImageUrl(
  image: SanityImageLike | null | undefined,
  params?: ImageUrlParams,
): string {
  const ref = image?.asset?._ref
  return ref ? buildSanityImageUrlFromRef(ref, params) : ''
}

export function buildSanityImageUrlFromRef(ref: string, params?: ImageUrlParams): string {
  if (!ref.startsWith('image-')) return ''
  const parts = ref.split('-')
  if (parts.length < 4) return ''
  const assetId = parts[1]
  const dims = parts[2]
  const ext = parts[3]
  const projectId = process.env.SANITY_PROJECT_ID ?? 'bk05c6rl'
  const dataset = process.env.SANITY_DATASET ?? 'production'
  const base = `https://cdn.sanity.io/images/${projectId}/${dataset}/${assetId}-${dims}.${ext}`
  const searchParams: string[] = []
  if (params?.autoFormat !== false) searchParams.push('auto=format')
  if (params?.w && Number.isFinite(params.w)) searchParams.push(`w=${Math.floor(params.w)}`)
  if (params?.h && Number.isFinite(params.h)) searchParams.push(`h=${Math.floor(params.h)}`)
  if (params?.fit) searchParams.push(`fit=${params.fit}`)
  if (params?.dpr && Number.isFinite(params.dpr)) searchParams.push(`dpr=${params.dpr}`)
  return searchParams.length > 0 ? `${base}?${searchParams.join('&')}` : base
}
