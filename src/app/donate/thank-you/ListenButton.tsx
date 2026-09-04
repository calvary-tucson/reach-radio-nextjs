import Link from 'next/link'

const BUTTON_CLASS =
  'w-full md:w-auto inline-flex items-center justify-center px-6 py-3 bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] font-bold uppercase rounded-full cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function ListenButton() {
  return (
    <Link href="/" className={BUTTON_CLASS}>
      Listen
    </Link>
  )
}
