import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer data-web-chrome="" className="overflow-hidden relative z-10 border-t border-t-gray-500 light:border-t-gray-200 px-[clamp(10px,_3vw,_30px)] py-[clamp(20px,_3vw,_30px)] bg-[var(--color-brand-gray)] light:bg-gray-100 mt-5">
      <div>
        <p className="text-gray-400 light:text-gray-500 text-xs mb-2 uppercase tracking-wider font-semibold">
          Appearance
        </p>
        <ThemeToggle />
      </div>

      <div className="mt-8 text-white light:text-gray-900 text-xs">
        Reach Radio is a ministry of{' '}
        <a
          className="font-bold border-b-2 border-b-green-500 pb-1"
          href="https://calvarytucson.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Calvary Tucson Church<span className="sr-only"> (opens in new tab)</span>
        </a>{' '}
        © {year}
      </div>

      <div className="mt-4">
        <div className="w-[50px] border-t border-gray-300 light:border-gray-400" />
        <div className="text-gray-300 light:text-gray-500 text-xs mt-1">
          Structured content powered by{' '}
          <a
            className="font-bold"
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.sanity.io/"
          >
            Sanity.io<span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
