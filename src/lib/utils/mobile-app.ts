import { headers } from 'next/headers'
import { cookies } from 'next/headers'

export async function detectMobileApp(): Promise<boolean> {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()])
  return (
    headersList.get('mobile-app') === 'true' ||
    cookieStore.get('mobile-app')?.value === 'true'
  )
}
