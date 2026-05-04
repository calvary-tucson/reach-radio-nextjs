import { createClient } from '@sanity/client'
import { cacheTag, cacheLife } from 'next/cache'

function getClient() {
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? 'bk05c6rl',
    dataset: process.env.SANITY_DATASET ?? 'production',
    apiVersion: '2024-02-22',
    perspective: 'published',
    useCdn: true,
  })
}

export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
  options: { tags?: string[] } = {}
): Promise<T> {
  'use cache'
  const { tags } = options
  cacheLife('days')
  if (tags?.length) {
    cacheTag(...tags)
  }
  return getClient().fetch<T>(query, params)
}
