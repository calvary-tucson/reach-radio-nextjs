import Link from 'next/link'

export function Header() {
  return (
    <header
      id="site-header"
      style={{ viewTransitionName: 'site-header' }}
      className="bg-[var(--color-brand-gray)] px-4 py-3 flex items-center justify-between"
    >
      <Link href="/" className="text-white font-bold text-lg">
        Reach Radio
      </Link>
      <nav className="hidden md:flex gap-6">
        <Link href="/" className="text-white/80 hover:text-white text-sm">Listen</Link>
        <Link href="/teachers" className="text-white/80 hover:text-white text-sm">Teachers</Link>
        <Link href="/about" className="text-white/80 hover:text-white text-sm">About</Link>
        <Link href="/donate" className="text-white/80 hover:text-white text-sm">Donate</Link>
      </nav>
    </header>
  )
}
