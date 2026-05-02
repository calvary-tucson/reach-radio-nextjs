import 'server-only'
import { createClient } from '@sanity/client'
import { cache } from 'react'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ?? 'bk05c6rl',
  dataset: process.env.SANITY_DATASET ?? 'production',
  apiVersion: '2024-02-22',
  perspective: 'published',
  useCdn: true,
})

export const sanityFetch = cache(
  async <T>(
    query: string,
    params: Record<string, unknown> = {},
    options: { tags?: string[]; revalidate?: number } = {}
  ): Promise<T> => {
    const { tags, revalidate } = options
    return client.fetch<T>(query, params, {
      next: {
        ...(tags ? { tags } : {}),
        ...(revalidate !== undefined ? { revalidate } : {}),
      },
    })
  }
)
