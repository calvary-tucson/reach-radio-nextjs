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

interface Rule {
  name: string
  /** Matches a banned class on a line. */
  pattern: RegExp
  /** Optional: line is OK if this also matches (e.g. a light variant is present). */
  unless?: RegExp
}

const RULES: Rule[] = [
  // Light theme: below 4.5:1 for any text, below 3:1 for icons.
  { name: 'light gray-100..400 text', pattern: /light:(?:hover:|placeholder:)?text-gray-(?:100|200|300|400)\b/ },
  // Light theme: green-600 text is 3.52:1.
  { name: 'light green-600 text', pattern: /light:text-green-600\b/ },
  // Dark theme: white alpha 10..40 is under 4:1 even for icons on some surfaces.
  { name: 'dark white/10..40 text', pattern: /(?<![\w-])(?:placeholder:)?text-white\/(?:10|15|20|25|30|35|40)\b/ },
  // Brand green text without a light variant is 2.1 to 2.35:1 on light.
  { name: 'brand green text without light variant', pattern: /(?<![\w-])text-\[#84b84f\]/, unless: /light:text-green-(?:700|800)\b/ },
]

describe('contrast class guard', () => {
  const files = walk(ROOT)

  for (const rule of RULES) {
    it(`no ${rule.name}`, () => {
      const hits: string[] = []
      for (const file of files) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (rule.pattern.test(line) && !(rule.unless && rule.unless.test(line))) {
            hits.push(`${file.replace(ROOT, 'src')}:${i + 1}`)
          }
        })
      }
      expect(hits, hits.join('\n')).toEqual([])
    })
  }
})
