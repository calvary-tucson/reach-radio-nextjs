'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { Theme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Theme; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="group" aria-label="Color theme" className="inline-flex items-center rounded-lg bg-white/5 light:bg-gray-100 p-0.5 gap-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 min-h-11 rounded-md text-xs font-medium motion-safe:transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            theme === value
              ? 'bg-[#84b84f] text-[#0a1305]'
              : 'text-white/60 hover:text-white/90 light:text-gray-500 light:hover:text-gray-900'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
