import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts|css)$/.test(name) ? [p] : []
  })
}

interface Allow {
  /** Path suffix relative to src, e.g. `app/about/page.tsx`. */
  file: string
  /** The allowed line must match this (content-based, so it survives line shifts). */
  line: RegExp
}

interface Rule {
  name: string
  /** Matches a banned class on a line. */
  pattern: RegExp
  /** Optional: line is OK if this also matches (e.g. a light variant is present). */
  unless?: RegExp
  /** Known exceptions, by file and line content. */
  allow?: Allow[]
}

// Any variant chain (hover:, focus:, group-hover:, disabled:, placeholder: ...) before the utility.
const VARIANTS = '(?:[a-z-]+:)*'

// Icon-only lines: icons need 3:1 (non-text), so white/50 is fine there. Everything else is readable text.
const ICON_ALLOW: Allow[] = [
  { file: 'app/about/page.tsx', line: /w-4 h-4 text-white\/50 light:text-gray-500 group-hover:text-white\/70/ },
  { file: 'components/global/PassiveSearchBar.tsx', line: /className="text-white\/50 light:text-gray-500 shrink-0"/ },
  { file: 'components/teachers/TeacherSearchBar.tsx', line: /h-4 w-4 text-white\/50 light:text-gray-500/ },
  { file: 'components/teachers/TeacherSearchClient.tsx', line: /<ChevronRight .*text-white\/50 light:text-gray-500/ },
]

const RULES: Rule[] = [
  // Light theme: below 4.5:1 for any text, below 3:1 for icons.
  { name: 'light gray-100..400 text', pattern: new RegExp(`light:${VARIANTS}text-gray-(?:100|200|300|400)\\b`) },
  // Light theme: green-600 text is 3.52:1.
  { name: 'light green-600 text', pattern: new RegExp(`light:${VARIANTS}text-green-600\\b`) },
  // Dark theme: readable text needs white/60 (icons white/50, allowlisted above).
  {
    name: 'dark white/<60 text',
    pattern: /(?<![\w-])text-white\/(?:[1-5]\d|\d)\b/,
    allow: ICON_ALLOW,
  },
  // Brand green text without a light variant is 2.1 to 2.35:1 on light.
  { name: 'brand green text without light variant', pattern: /(?<![\w-])text-\[#84b84f\]/i, unless: /light:text-green-(?:700|800)\b/ },
]

function violates(rule: Rule, file: string, line: string): boolean {
  if (!rule.pattern.test(line)) return false
  if (rule.unless?.test(line)) return false
  if (rule.allow?.some((a) => file.endsWith(a.file) && a.line.test(line))) return false
  return true
}

describe('contrast class guard', () => {
  const files = walk(ROOT)

  for (const rule of RULES) {
    it(`no ${rule.name}`, () => {
      const hits: string[] = []
      for (const file of files) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (violates(rule, file, line)) hits.push(`${file.replace(ROOT, 'src')}:${i + 1}`)
        })
      }
      expect(hits, hits.join('\n')).toEqual([])
    })
  }

  it('allowlisted icon lines still exist (stale allowlist entries fail)', () => {
    for (const a of ICON_ALLOW) {
      const lines = readFileSync(join(ROOT, a.file), 'utf8').split('\n')
      expect(lines.some((l) => a.line.test(l)), a.file).toBe(true)
    }
  })
})

describe('contrast class guard regexes (fixtures)', () => {
  const rule = (name: string) => RULES.find((r) => r.name === name)!
  const hit = (name: string, line: string, file = 'x.tsx') => violates(rule(name), file, line)

  it('flags text-white below /60, including variants, and passes /60+', () => {
    const n = 'dark white/<60 text'
    expect(hit(n, 'className="text-white/55"')).toBe(true)
    expect(hit(n, 'className="hover:text-white/40"')).toBe(true)
    expect(hit(n, 'className="placeholder:text-white/50"')).toBe(true)
    expect(hit(n, 'className="text-white/5"')).toBe(true)
    expect(hit(n, 'className="text-white/60"')).toBe(false)
    expect(hit(n, 'className="text-white/90"')).toBe(false)
    expect(hit(n, 'className="border-white/20 bg-white/10"')).toBe(false)
  })

  it('allowlist only exempts the named file and line shape', () => {
    const n = 'dark white/<60 text'
    const line = 'className="text-white/50 light:text-gray-500 shrink-0"'
    expect(hit(n, line, '/src/components/global/PassiveSearchBar.tsx')).toBe(false)
    expect(hit(n, line, '/src/components/global/Other.tsx')).toBe(true)
  })

  it('flags light gray-100..400 text through focus/group-hover/disabled variants', () => {
    const n = 'light gray-100..400 text'
    expect(hit(n, 'light:text-gray-400')).toBe(true)
    expect(hit(n, 'light:focus:text-gray-300')).toBe(true)
    expect(hit(n, 'light:group-hover:text-gray-200')).toBe(true)
    expect(hit(n, 'light:disabled:text-gray-400')).toBe(true)
    expect(hit(n, 'light:text-gray-500')).toBe(false)
    expect(hit(n, 'light:text-gray-600')).toBe(false)
    expect(hit(n, 'light:bg-gray-100')).toBe(false)
  })

  it('flags light green-600 text, not borders', () => {
    const n = 'light green-600 text'
    expect(hit(n, 'light:hover:text-green-600')).toBe(true)
    expect(hit(n, 'light:border-green-600')).toBe(false)
    expect(hit(n, 'light:text-green-700')).toBe(false)
  })

  it('brand green hex match is case-insensitive and honors the light variant', () => {
    const n = 'brand green text without light variant'
    expect(hit(n, 'text-[#84b84f]')).toBe(true)
    expect(hit(n, 'text-[#84B84F]')).toBe(true)
    expect(hit(n, 'text-[#84B84F] light:text-green-700')).toBe(false)
  })
})
