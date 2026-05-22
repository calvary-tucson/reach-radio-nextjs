'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer id="site-footer" className="bg-[var(--color-brand-gray)] px-4 py-6 mt-8 text-center text-white/60 text-sm">
      <p>© {new Date().getFullYear()} Reach Radio / Calvary Chapel of Tucson</p>
      <div className="flex justify-center gap-4 mt-2">
        <Link href="/about/privacy-policy" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded">Privacy Policy</Link>
        <Link href="/about" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded">Contact</Link>
      </div>
      <div className="mt-8">
        <div className="w-[50px] border-t border-white/20 mb-1 mx-auto" />
        <p className="text-white/60 text-xs">
          Structured content powered by{' '}
          <a
            href="https://www.sanity.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold hover:text-white/60 transition-colors"
          >
            Sanity.io
          </a>
        </p>
      </div>
    </footer>
  )
}
