import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'


const mockFetch = vi.fn()
vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => ({ fetch: mockFetch })),
}))

const mockCacheTag = vi.fn()
const mockCacheLife = vi.fn()
vi.mock('next/cache', () => ({
  cacheTag: (...args: string[]) => mockCacheTag(...args),
  cacheLife: (profile: string) => mockCacheLife(profile),
  revalidateTag: vi.fn(),
}))

describe('sanityFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubEnv('SANITY_PROJECT_ID', 'test-project')
    vi.stubEnv('SANITY_DATASET', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('calls cacheLife with "days"', async () => {
    mockFetch.mockResolvedValue([])
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[_type == "teacher"]')
    expect(mockCacheLife).toHaveBeenCalledWith('days')
  })

  it('calls cacheTag with provided tags', async () => {
    mockFetch.mockResolvedValue([])
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[_type == "teacher"]', {}, { tags: ['teachers'] })
    expect(mockCacheTag).toHaveBeenCalledWith('teachers')
  })

  it('does not call cacheTag when no tags provided', async () => {
    mockFetch.mockResolvedValue([])
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[_type == "teacher"]')
    expect(mockCacheTag).not.toHaveBeenCalled()
  })

  it('returns data from Sanity client', async () => {
    mockFetch.mockResolvedValue([{ name: 'John' }])
    const { sanityFetch } = await import('@/lib/sanity/client')
    const result = await sanityFetch('*[_type == "teacher"]')
    expect(result).toEqual([{ name: 'John' }])
  })

  it('passes query params to Sanity client', async () => {
    mockFetch.mockResolvedValue(null)
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[slug.current == $slug]', { slug: 'john' })
    expect(mockFetch).toHaveBeenCalledWith(
      '*[slug.current == $slug]',
      { slug: 'john' }
    )
  })
})
