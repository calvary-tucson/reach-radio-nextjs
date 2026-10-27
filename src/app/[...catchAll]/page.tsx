import { notFound } from 'next/navigation'

// Unmatched URLs otherwise fall through to the @modal catch-all and return 200.
export default function UnmatchedRoute() {
  notFound()
}
