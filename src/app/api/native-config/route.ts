import { sanityFetch } from '@/lib/sanity/client'
import { appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'

const FALLBACK_STREAM_URL = 'https://stream.radiojar.com/g4d600bv6p5tv'

export async function GET(): Promise<Response> {
  const settings = await sanityFetch<{ radioAudioURL: string }>(
    appSettingsQuery,
    { id: APP_SETTINGS_ID },
    { tags: ['appSettings'] }
  ).catch(() => null)

  return Response.json(
    {
      protocolVersion: 1,
      streamUrl: settings?.radioAudioURL ?? FALLBACK_STREAM_URL,
      webUrl: 'https://reach-radio-web.pages.dev',
      minAppVersion: { ios: '1.0.0', android: '1.0.0' },
    },
    {
      headers: { 'Cache-Control': 'public, max-age=300' },
    }
  )
}
