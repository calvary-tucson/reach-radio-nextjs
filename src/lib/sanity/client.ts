import { createClient } from '@sanity/client'
import { cacheTag, cacheLife } from 'next/cache'

const projectId = process.env.SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET

if (!projectId) throw new Error('Missing env var: SANITY_PROJECT_ID')
if (!dataset) throw new Error('Missing env var: SANITY_DATASET')

const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-02-22',
  perspective: 'published',
  useCdn: true,
})

export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
  options: { tags?: string[] } = {}
): Promise<T> {
  const { tags } = options
  cacheLife('days')
  if (tags?.length) {
    cacheTag(...tags)
  }
  return sanityClient.fetch<T>(query, params)
}
