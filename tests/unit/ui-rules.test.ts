import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..', 'src')
const COMPONENTS = join(SRC, 'components')

interface Violation {
  file: string
  line: number
  rule: 'cursor-pointer' | 'motion-safe' | 'aria-label'
  snippet: string
}

interface Allow {
  /** Path relative to src, e.g. `components/foo/Bar.tsx`. */
  file: string
  rule: Violation['rule']
  /** Content-based (survives line shifts): must match the violation snippet. */
  snippet: RegExp
  reason: string
}

// Keep this short. Prefer fixing the markup. Each entry needs a reason.
const ALLOW: Allow[] = []

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(name) ? [p] : []
  })
}

function attr(attrs: ts.JsxAttributes, name: string, sf: ts.SourceFile): string | undefined {
  for (const a of attrs.properties) {
    if (ts.isJsxAttribute(a) && a.name.getText(sf) === name) return a.initializer ? a.initializer.getText(sf) : ''
  }
  return undefined
}

/** True when the JSX child subtree can render visible text (unknown expressions count as text). */
function hasText(n: ts.Node): boolean {
  if (ts.isJsxText(n)) return !n.containsOnlyTriviaWhiteSpaces
  if (ts.isJsxElement(n) || ts.isJsxFragment(n)) return n.children.some(hasText)
  if (ts.isJsxSelfClosingElement(n)) return false
  if (ts.isJsxExpression(n)) return n.expression ? hasText(n.expression) : false
  if (ts.isParenthesizedExpression(n)) return hasText(n.expression)
  if (ts.isConditionalExpression(n)) return hasText(n.whenTrue) || hasText(n.whenFalse)
  if (ts.isBinaryExpression(n)) return hasText(n.right)
  if (n.kind === ts.SyntaxKind.NullKeyword) return false
  return true
}

export function scan(source: string, file: string): Violation[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: Violation[] = []
  const add = (node: ts.Node, rule: Violation['rule']) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    out.push({ file, line: line + 1, rule, snippet: node.getText(sf).split('\n')[0].trim() })
  }

  const check = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement, children?: ts.NodeArray<ts.JsxChild>) => {
    const tag = el.tagName.getText(sf)
    if (!/^[a-z]/.test(tag)) return // components own their classes
    const attrs = el.attributes
    if (attrs.properties.some((p) => ts.isJsxSpreadAttribute(p))) return // props may carry className
    const role = (attr(attrs, 'role', sf) ?? '').replace(/["'{}\s]/g, '')
    if (role === 'presentation' || role === 'none') return
    const cls = attr(attrs, 'className', sf) ?? ''
    const clickable = tag === 'button' || attr(attrs, 'onClick', sf) !== undefined || role === 'button'
    if (clickable && !cls.includes('cursor-pointer')) add(el, 'cursor-pointer')
    if (
      tag === 'button' &&
      children &&
      children.some((c) => !ts.isJsxText(c)) &&
      !children.some(hasText) &&
      attr(attrs, 'aria-label', sf) === undefined &&
      attr(attrs, 'aria-labelledby', sf) === undefined
    ) {
      add(el, 'aria-label')
    }
  }

  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n)) check(n.openingElement, n.children)
    else if (ts.isJsxSelfClosingElement(n)) check(n)
    ts.forEachChild(n, visit)
  }
  visit(sf)

  source.split('\n').forEach((text, i) => {
    for (const m of text.matchAll(/[^\s"'`{]*animate-[^\s"'`}]*/g)) {
      if (!m[0].includes('motion-safe:')) {
        out.push({ file, line: i + 1, rule: 'motion-safe', snippet: m[0] })
      }
    }
  })
  return out
}

describe('AGENTS.md UI rules', () => {
  it('flags a clickable element without cursor-pointer (positive control)', () => {
    const v = scan('export const X = () => <div onClick={() => {}} className="p-2">x</div>', 'f.tsx')
    expect(v.map((x) => x.rule)).toEqual(['cursor-pointer'])
  })

  it('flags a multi-line button without cursor-pointer (positive control)', () => {
    const src = 'export const X = () => (\n  <button\n    type="button"\n    className="p-2"\n  >\n    Go\n  </button>\n)'
    expect(scan(src, 'f.tsx').map((x) => x.rule)).toEqual(['cursor-pointer'])
  })

  it('flags animate- without motion-safe (positive control)', () => {
    const v = scan('export const X = () => <div className="animate-spin" />', 'f.tsx')
    expect(v.map((x) => x.rule)).toEqual(['motion-safe'])
  })

  it('flags an icon-only button without aria-label (positive control)', () => {
    const src = 'export const X = () => <button className="cursor-pointer"><Icon /></button>'
    expect(scan(src, 'f.tsx').map((x) => x.rule)).toEqual(['aria-label'])
  })

  it('accepts compliant markup (negative control)', () => {
    const src = [
      'export const X = () => (',
      '  <div role="presentation" onClick={() => {}}>',
      '    <button aria-label="Close" className="cursor-pointer motion-safe:animate-spin"><Icon /></button>',
      '    <button className="cursor-pointer">Save</button>',
      '  </div>',
      ')',
    ].join('\n')
    expect(scan(src, 'f.tsx')).toEqual([])
  })

  it('src/components has no violations', () => {
    const found: string[] = []
    for (const path of walk(COMPONENTS)) {
      const rel = relative(SRC, path)
      for (const v of scan(readFileSync(path, 'utf8'), rel)) {
        const allowed = ALLOW.some((a) => a.file === rel && a.rule === v.rule && a.snippet.test(v.snippet))
        if (!allowed) found.push(`${rel}:${v.line} [${v.rule}] ${v.snippet}`)
      }
    }
    expect(found, found.join('\n')).toEqual([])
  })
})
