import Link from 'next/link'

export async function Footer() {
  'use cache'
  const year = new Date().getFullYear()
  return (
    <footer id="site-footer" className="bg-[var(--color-brand-gray)] px-4 py-6 mt-8 text-center text-white/60 text-sm">
      <p>© {year} Reach Radio / Calvary Chapel of Tucson</p>
      <div className="flex justify-center gap-4 mt-2">
        <Link href="/about/privacy-policy" className="hover:text-white">Privacy Policy</Link>
        <Link href="/about" className="hover:text-white">Contact</Link>
      </div>
    </footer>
  )
}
