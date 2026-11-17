# Reach Radio Gates (Tier 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Machine-enforce the `AGENTS.md` UI/a11y/commit-scope rules and the lint, type and test baseline with a local pre-push hook, a commit-msg hook, more `jsx-a11y` lint rules and a UI-rule scan test.

**Architecture:** Committed `.githooks/` (`pre-push`, `commit-msg`) activated by an npm `prepare` script that sets `core.hooksPath`; `eslint.config.mjs` gains the `jsx-a11y` recommended rules after the 5 existing violations are fixed; a vitest test scans `src/components` with the TypeScript compiler API for the AGENTS.md UI rules; commitlint enforces the 15 canonical scopes. No CI (owner chose pre-push only).

**Tech Stack:** Next 16 app (AGENTS.md: read `node_modules/next/dist/docs/` before touching app code; this plan touches tooling and two components only), vitest, eslint 9 flat config, TypeScript compiler API (`typescript` is already a devDependency), bash, commitlint.

Spec: `docs/superpowers/specs/2026-11-16-reach-radio-gates-design.md`.

## Global Constraints

- Work only in the murex worktree (`/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/murex`, branch `calvary-tucson/research-claude-code-harnesses`). Allowed files are listed per task; needing another file means stop and report.
- Baseline measured 2026-11-16: `npx eslint src` clean, `npx tsc --noEmit` clean, `eslint-plugin-jsx-a11y` recommended set gives exactly 5 violations: `src/components/AudioProvider.tsx:87` (media-has-caption), `src/components/about/ContactSheet.tsx:64` and `:74` (click-events-have-key-events + no-static-element-interactions each).
- AGENTS.md UI rules to enforce: clickables have `cursor-pointer`; animations are `motion-safe:`; icon-only buttons have `aria-label`. Disabled buttons also get `cursor-not-allowed` (not scanned).
- Canonical commit scopes (exact): bridge, seo, teachers, schedule, theme, modal, player, sleep-timer, donate, about, layout, api, global, ppr, test. Fix commits use the component's scope (`fix(about):` for ContactSheet, `fix(player):` for AudioProvider). Tooling commits use no scope: `chore:`, `feat:`, `test:`.
- `prepare` MUST end `|| true`: Vercel runs `npm ci` (and so `prepare`) in a checkout without usable git config; a failing `prepare` would break deploys.
- Hooks fail loudly with a clear message, but a missing `node_modules` only prints "run npm install".
- Do NOT edit `~/.claude/*`, `settings.json`, `.claude/harness.json` or any `src` file not named in a task.
- Commit with pathspecs: `git add <paths>` then `git commit -m "..." -- <paths>`. Never amend, reset or `git add -A`. Commits need the sandbox off (pre-approved in the dispatch prompt).
- `chmod +x`, `npm install` and the Doppler `next build` need the sandbox off (all pre-approved in the dispatch prompt).
- NEVER run `git config core.hooksPath` or let `prepare` run mid-plan: it writes the shared git config for every worktree. All `npm install` calls use `--ignore-scripts`. Verified 2026-11-16: `node_modules` in murex is a real directory; main checkout `.git/hooks` has only samples (precheck again in Task 5).
- Baseline commands the hook runs, measured 2026-11-16: `npm run lint` is bare `eslint` (whole repo, clean, ~5 s), `npm test` is `vitest run`, `typecheck` is new.
- Suggest-tools: run `shellcheck .githooks/* tests/hooks/test-githooks.sh` if `command -v shellcheck` finds it; installing it is an owner Yes/No, never automatic. `$TMPDIR` for temp files; shell tests use `mktemp -d "${TMPDIR:-/tmp}/<prefix>.XXXXXX"`, an existence check, and a prefix-guarded `rm -rf`.
- Memory: tests use tiny synthetic fixtures; the UI scan reads one file at a time.
- Use Edit/Write tools to change files, not inline scripts.
- Run tests with `npx vitest run <file>`; full suite `npm test`.

## File Structure

- Modify `eslint.config.mjs`: add `jsx-a11y` recommended rules for `src/**`.
- Modify `src/components/about/ContactSheet.tsx`, `src/components/AudioProvider.tsx`: clear the 5 violations.
- Create `tests/unit/ui-rules.test.ts`: AST scan + positive controls.
- Modify `package.json`, `package-lock.json`: `typecheck` and `prepare` scripts; devDependencies `eslint-plugin-jsx-a11y`, `@commitlint/cli`, `@commitlint/config-conventional`.
- Create `.githooks/pre-push`, `.githooks/commit-msg`, `tests/hooks/test-githooks.sh`.
- Create `commitlint.config.mjs`.

---

### Task 1: Clear the 5 jsx-a11y violations, then turn the rules on

**Files:**
- Modify: `src/components/about/ContactSheet.tsx` (the two `<div` openers at lines 64 and 74)
- Modify: `src/components/AudioProvider.tsx` (the `<audio` element at line 87)
- Modify: `eslint.config.mjs`
- Modify: `package.json`, `package-lock.json` (devDependency only)

**Interfaces:** Produces `npm run lint` that includes `jsx-a11y` recommended rules on `src/**` and still exits 0.

- [ ] **Step 1: Record the test baseline**

Run: `npm run lint && npm test 2>&1 | tail -6`
Expected: lint silent, all tests pass. Write the pass count in your report.

- [ ] **Step 2: Add the plugin as an explicit devDependency (sandbox off, network)**

Run: `npm install --ignore-scripts -D eslint-plugin-jsx-a11y@^6.10.2 @commitlint/cli @commitlint/config-conventional`
Expected: `package.json` devDependencies gains the three packages (commitlint is installed here, before `prepare` exists; Task 4 only configures it). jsx-a11y is already installed at 6.10.2 via eslint-config-next. Check: `git diff --stat package.json package-lock.json`.

- [ ] **Step 3: Enable the rules and see the 5 failures**

In `eslint.config.mjs`, add the import after the `nextTs` import:

```js
import jsxA11y from "eslint-plugin-jsx-a11y";
```

and insert this object in the `defineConfig([...])` array right after `...nextTs,`:

```js
  // AGENTS.md a11y rules, machine-enforced. The plugin itself is already registered by
  // eslint-config-next, so only the rules are added (redeclaring the plugin throws).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
```

Run: `npx eslint src 2>&1 | grep -c "jsx-a11y"`
Expected: 5.

- [ ] **Step 4: Fix ContactSheet**

In `src/components/about/ContactSheet.tsx` add `role="presentation"` to the backdrop `<div` (the one with `id="contact-sheet"`) and to the inner `<div onClick={(e) => e.stopPropagation()}>`. The inner one becomes:

```tsx
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
```

and the backdrop opener becomes:

```tsx
    <div
      role="presentation"
      id="contact-sheet"
```

(rest of the attributes unchanged). Rationale: both divs are click-propagation/dismiss helpers, not controls; keyboard dismissal exists (document `keydown` Escape handler at ContactSheet.tsx:47-51, confirmed 2026-11-16). Re-confirm with `grep -n Escape src/components/about/ContactSheet.tsx` before editing; if gone, stop and report.

- [ ] **Step 5: Fix AudioProvider**

In `src/components/AudioProvider.tsx` put a line comment directly above `<audio` inside the `return (`:

```tsx
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- live radio stream, aria-hidden, no captions exist
    <audio
```

- [ ] **Step 6: Verify**

Run: `npx eslint src && npx tsc --noEmit && npx vitest run tests/unit/contact-sheet.test.tsx tests/unit/audio-provider.test.tsx`
Expected: eslint and tsc print nothing; vitest passes.

- [ ] **Step 7: Commit (three commits, component fixes first so lint is never red)**

```bash
git add src/components/about/ContactSheet.tsx
git commit -m "fix(about): mark ContactSheet click helpers as presentation for jsx-a11y" -- src/components/about/ContactSheet.tsx
git add src/components/AudioProvider.tsx
git commit -m "fix(player): justify missing captions on the live stream audio element" -- src/components/AudioProvider.tsx
git add eslint.config.mjs package.json package-lock.json
git commit -m "chore: enable jsx-a11y recommended rules and add commitlint dev dependencies" -- eslint.config.mjs package.json package-lock.json
```

---

### Task 2: UI-rule class-scan test

**Files:**
- Create: `tests/unit/ui-rules.test.ts`
- Modify (only to clear a real violation the scan finds): files under `src/components/**` named by the scan output

**Interfaces:** Produces the vitest suite `AGENTS.md UI rules`, including positive controls.

- [ ] **Step 1: Write the test**

Create `tests/unit/ui-rules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/unit/ui-rules.test.ts`
Expected: the five control tests PASS. The last test lists the real violations (each as `file:line [rule] snippet`) or passes if there are none.

- [ ] **Step 3: Clear each real violation**

For every line the last test lists, open the file and fix the markup: add `cursor-pointer` to the element's `className`, add `motion-safe:` to the animation class, or add an `aria-label` that names the action. If the element is genuinely not a control or the class is applied indirectly (for example className built in a helper the scanner cannot see), add an `ALLOW` entry with a one-line `reason` instead. Do not weaken the scanner. Record the count fixed and the count allowlisted in your report.

- [ ] **Step 4: Run lint, types and the whole suite**

Run: `npm run lint && npx tsc --noEmit && npm test 2>&1 | tail -6`
Expected: clean; all tests pass (Task 1 baseline count plus 6).

- [ ] **Step 5: Commit**

If Step 3 changed component files, commit them first, one commit per canonical scope (use the component's scope from Global Constraints, `global` for shared primitives):

```bash
git add <files of one scope>
git commit -m "fix(<scope>): add missing cursor-pointer/aria-label/motion-safe found by the UI-rule scan" -- <files of one scope>
```

Then the test:

```bash
git add tests/unit/ui-rules.test.ts
git commit -m "test: scan src/components for the AGENTS.md UI rules" -- tests/unit/ui-rules.test.ts
```

---

### Task 3: Pre-push hook, `prepare` and `typecheck`, shell test

**Files:**
- Create: `.githooks/pre-push`
- Create: `tests/hooks/test-githooks.sh`
- Modify: `package.json`

**Interfaces:** Produces `npm run typecheck`, the `prepare` script, and `.githooks/pre-push` (reads git's pre-push stdin: `<local ref> <local sha> <remote ref> <remote sha>` per line).

- [ ] **Step 1: Add the scripts**

In `package.json`, replace
`    "test:e2e": "playwright test"`
with
```json
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "prepare": "git config core.hooksPath .githooks || true"
```

- [ ] **Step 2: Write the failing shell test**

Create `tests/hooks/test-githooks.sh`:

```bash
#!/usr/bin/env bash
# Integration test for .githooks/pre-push and .githooks/commit-msg against a throwaway remote + clone with stub npm/npx.
HERE="$(cd "$(dirname "$0")" && pwd)"; REAL="$(cd "$HERE/../.." && pwd)"; HOOKS="$REAL/.githooks"
T="$(mktemp -d "${TMPDIR:-/tmp}/ghooks.XXXXXX")" || exit 1
[ -d "$T" ] || exit 1
T="$(cd "$T" && pwd -P)"
trap 'case "$T" in */ghooks.*) rm -rf "$T" ;; esac' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
BIN="$T/bin"; mkdir -p "$BIN"; LOG="$T/calls.log"; : > "$LOG"
for tool in npm npx; do
  cat > "$BIN/$tool" <<EOF
#!/bin/bash
echo "$tool \$*" >> "\$CALLS_LOG"
if [ -n "\${FAIL_ON:-}" ]; then case "$tool \$*" in "$tool \$FAIL_ON"*) exit 1;; esac; fi
exit 0
EOF
  chmod +x "$BIN/$tool"
done
export PATH="$BIN:$PATH" CALLS_LOG="$LOG"
fail=0
chk() { if [ "$1" = "$2" ]; then echo "ok   $3"; else echo "FAIL $3 (want '$1' got '$2')"; fail=1; fi; }
calls() { tr '\n' '|' < "$LOG"; }
reset() { : > "$LOG"; unset FAIL_ON; }

git init -q --bare -b main "$T/remote.git"
git clone -q "$T/remote.git" "$T/work" 2>/dev/null
cd "$T/work" || exit 1
git checkout -q -b main 2>/dev/null
mkdir -p src docs node_modules/.bin
touch node_modules/.bin/commitlint; chmod +x node_modules/.bin/commitlint
echo a > README.md
git add README.md
git -c core.hooksPath=/dev/null commit -q -m "init"
git -c core.hooksPath=/dev/null push -q origin main
git config core.hooksPath "$HOOKS"
plain_commit() { git -c core.hooksPath=/dev/null commit -q -m "$1"; }

reset; echo d > docs/a.md; git add docs/a.md; plain_commit "docs: a"
git push -q origin main; chk 0 "$?" "docs-only push exits 0"
chk "" "$(calls)" "docs-only push runs no checks"

reset; echo s > src/a.ts; git add src/a.ts; plain_commit "feat: a"
git push -q origin main; chk 0 "$?" "src push exits 0"
chk "npm run lint|npm run typecheck|npm test|" "$(calls)" "src push runs lint, typecheck, test in order"

reset; echo s2 > src/b.ts; git add src/b.ts; plain_commit "feat: b"
FAIL_ON="run typecheck" git push -q origin main 2>/dev/null; chk 1 "$?" "failing typecheck blocks the push"
chk "npm run lint|npm run typecheck|" "$(calls)" "stops at the first failing check"
reset
git push -q origin main; chk 0 "$?" "retry passes once the check passes"

reset; git checkout -q -b feat/x; echo s3 > src/c.ts; git add src/c.ts; plain_commit "feat: c"
git push -q origin feat/x 2>/dev/null; chk 0 "$?" "new-branch push exits 0"
chk "npm run lint|npm run typecheck|npm test|" "$(calls)" "new-branch push with src change runs checks"

reset; git checkout -q main; mv node_modules node_modules.off; echo s4 > src/d.ts; git add src/d.ts; plain_commit "feat: d"
git push -q origin main 2>/dev/null; chk 1 "$?" "missing node_modules blocks with a message"
chk "" "$(calls)" "missing node_modules runs no npm"
mv node_modules.off node_modules; reset

reset; echo m > src/e.ts; git add src/e.ts
git commit -q -m "fix(teachers): e" 2>/dev/null; chk 0 "$?" "commit-msg passes when commitlint passes"
case "$(calls)" in "npx --no commitlint --edit "*) r=ok;; *) r="$(calls)";; esac; chk ok "$r" "commit-msg calls commitlint --edit"
reset; echo m2 > src/f.ts; git add src/f.ts
FAIL_ON="--no commitlint" git commit -q -m "bad(scope): f" 2>/dev/null; chk 1 "$?" "commit-msg blocks when commitlint fails"

reset; mv node_modules/.bin/commitlint node_modules/.bin/commitlint.off; echo m3 > src/g.ts; git add src/g.ts
err="$(git commit -q -m "anything goes here" 2>&1)"; chk 0 "$?" "commit-msg skips when commitlint is not installed"
chk "" "$(calls)" "skip path runs no npx"
case "$err" in *"not installed"*) r=ok;; *) r="$err";; esac; chk ok "$r" "skip path prints a notice"
mv node_modules/.bin/commitlint.off node_modules/.bin/commitlint; reset

pre="$(node -e 'console.log(require(process.argv[1]).scripts.prepare)' "$REAL/package.json")"
case "$pre" in *"|| true") r=ok;; *) r="$pre";; esac; chk ok "$r" "prepare never fails an install (|| true)"
chk 100755 "$(cd "$REAL" && git ls-files -s .githooks/pre-push | cut -d' ' -f1)" "pre-push is executable in git"

[ "$fail" = 0 ] && echo "ALL PASS" || { echo "FAILURES"; exit 1; }
```

Run: `bash tests/hooks/test-githooks.sh`
Expected: FAIL lines (hooks do not exist yet).

- [ ] **Step 3: Write `.githooks/pre-push`**

```bash
#!/bin/bash
# pre-push gate: lint, typecheck, unit tests. Skipped when the push touches no code/config files.
# Bypass (deliberate, visible in your shell history): git push --no-verify
set -u
ZERO=0000000000000000000000000000000000000000
changed=""
while read -r _lref lsha _rref rsha; do
  [ "$lsha" = "$ZERO" ] && continue            # deleting a remote ref
  if [ "$rsha" = "$ZERO" ]; then
    base="$(git merge-base "$lsha" origin/main 2>/dev/null || true)"   # new branch: compare to main
  else
    base="$rsha"
  fi
  if [ -n "$base" ] && files="$(git diff --name-only "$base" "$lsha" 2>/dev/null)"; then
    changed="$changed"$'\n'"$files"
  else
    changed="$changed"$'\n'"always"            # cannot tell what changed: run the checks
  fi
done
printf '%s\n' "$changed" | grep -Eq '^(always$|src/|tests/|eslint\.config\.|package\.json$|package-lock\.json$|tsconfig\.json$|next\.config\.|vitest\.config\.|commitlint\.config\.)' || exit 0

cd "$(git rev-parse --show-toplevel)" || exit 1
[ -d node_modules ] || { echo "pre-push: node_modules missing; run npm install first" >&2; exit 1; }
for cmd in "npm run lint" "npm run typecheck" "npm test"; do
  echo "pre-push: $cmd"
  $cmd || { echo "pre-push: '$cmd' failed; push blocked (fix it, or git push --no-verify to bypass)" >&2; exit 1; }
done
exit 0
```

- [ ] **Step 4: Make it executable, run the test (sandbox off for chmod)**

Run: `chmod +x .githooks/pre-push tests/hooks/test-githooks.sh && git add .githooks/pre-push && bash tests/hooks/test-githooks.sh`
Expected: pre-push cases `ok`. The commit-msg cases still FAIL until Task 4 (the hook file does not exist); that is expected. The last two lines (`prepare`, executable) are `ok`.

- [ ] **Step 5: Commit**

```bash
git add .githooks/pre-push tests/hooks/test-githooks.sh package.json
git commit -m "chore: add pre-push gate (lint, typecheck, tests) and typecheck/prepare scripts" -- .githooks/pre-push tests/hooks/test-githooks.sh package.json
```

---

### Task 4: commitlint and the commit-msg hook

**Files:**
- Create: `commitlint.config.mjs`
- Create: `.githooks/commit-msg`
- Modify: `tests/hooks/test-githooks.sh`

**Interfaces:** Produces `node_modules/.bin/commitlint` enforcing the scope enum; `.githooks/commit-msg` calls `npx --no commitlint --edit "$1"` only when `node_modules/.bin/commitlint` exists.

- [ ] **Step 1: Confirm commitlint is installed (Task 1 Step 2 installed it with `--ignore-scripts`)**

Run: `ls node_modules/.bin/commitlint; git config --get core.hooksPath; echo "hooksPath-exit=$?"`
Expected: the path prints; `hooksPath-exit=1` (unset). If hooksPath is set, stop and report: something ran `prepare`.

- [ ] **Step 2: Create `commitlint.config.mjs`**

```js
// Canonical scopes live in AGENTS.md ("Canonical Commit Scopes"). Keep the two lists identical.
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "bridge", "seo", "teachers", "schedule", "theme", "modal", "player", "sleep-timer",
        "donate", "about", "layout", "api", "global", "ppr", "test",
      ],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
  },
};

export default config;
```

- [ ] **Step 3: Check the rules directly**

Run each and compare:
```bash
for m in "fix(teachers): x" "chore: x" "docs: x" "fix(Teachers): x" "feat(nonsense): x"; do printf '%s\n' "$m" | node_modules/.bin/commitlint >/dev/null 2>&1; echo "$? $m"; done
```
Expected, in order: `0 fix(teachers): x`, `0 chore: x`, `0 docs: x`, `1 fix(Teachers): x`, `1 feat(nonsense): x`.

- [ ] **Step 4: Create `.githooks/commit-msg`**

```bash
#!/bin/bash
# commit-msg: enforce the canonical commit scopes (AGENTS.md) with commitlint.
# Skipped with a notice when node_modules is not installed. Bypass: git commit --no-verify
set -u
cd "$(git rev-parse --show-toplevel)" || exit 0
if [ ! -x node_modules/.bin/commitlint ]; then
  echo "commit-msg: commitlint not installed (run npm install); skipping" >&2
  exit 0
fi
exec npx --no commitlint --edit "$1"
```

- [ ] **Step 5: Add the real-commitlint cases to the shell test**

In `tests/hooks/test-githooks.sh`, insert before the `pre="$(node -e` line:

```bash
if [ -x "$REAL/node_modules/.bin/commitlint" ]; then
  cl() { printf '%s\n' "$1" | (cd "$REAL" && ./node_modules/.bin/commitlint >/dev/null 2>&1); echo $?; }
  chk 0 "$(cl 'fix(teachers): x')" "commitlint accepts a canonical scope"
  chk 0 "$(cl 'docs: x')" "commitlint accepts no scope"
  chk 1 "$(cl 'fix(Teachers): x')" "commitlint rejects a PascalCase scope"
  chk 1 "$(cl 'feat(nonsense): x')" "commitlint rejects an undocumented scope"
else
  echo "FAIL commitlint is not installed in the repo (run npm install)"; fail=1
fi
```

- [ ] **Step 6: Make it executable and run all hook tests**

Run: `chmod +x .githooks/commit-msg && git add .githooks/commit-msg && bash tests/hooks/test-githooks.sh`
Expected: every line `ok`, last line `ALL PASS`.

- [ ] **Step 7: Commit**

```bash
git add commitlint.config.mjs .githooks/commit-msg tests/hooks/test-githooks.sh package.json package-lock.json
git commit -m "chore: add commitlint with the canonical scope enum and a commit-msg hook" -- commitlint.config.mjs .githooks/commit-msg tests/hooks/test-githooks.sh package.json package-lock.json
```

---

### Task 5: Verify everything, then stop for the owner-gated activation

**Files:** none changed (fix-ups go back to the owning task's files and are reported).

- [ ] **Step 1: Run every check**

```bash
npm run lint && npm run typecheck && npm test 2>&1 | tail -6 && bash tests/hooks/test-githooks.sh && { command -v shellcheck >/dev/null && shellcheck .githooks/* tests/hooks/test-githooks.sh || echo 'shellcheck not installed (skipped)'; }
```
Expected: eslint and tsc silent; vitest all pass (Task 1 baseline + 6); `ALL PASS`.

- [ ] **Step 2: Run the repo build gate**

`.claude/harness.json` requires a build after `src` or `package.json` changes. Run: `doppler run --project reach-radio-nextjs --config dev -- npx next build 2>&1 | tail -25` (sandbox off; needs the network and the Doppler login). Expected: build succeeds and the route table prints. If Doppler needs a login or fails for a reason outside the plan, stop with `WAITING ON owner: <exact error>`.

- [ ] **Step 3: Confirm scope and the hooks precheck**

Run: `ls "$(git rev-parse --git-common-dir)/hooks" | grep -v '\.sample$'` — any output is a real hook that `core.hooksPath` would silently disable; include it in the owner ask below.


Run: `git status --short` and `git diff --stat abed32a..HEAD -- . ':!docs'`
Expected: clean tree; changed files are exactly those in File Structure plus any component files fixed in Task 2.

- [ ] **Step 4: Stop**

Do not run `git config core.hooksPath .githooks` (it writes the shared git config for every worktree of this repo) and do not push. End with `DONE <plan path>` plus the commit list, the Task 2 counts (fixed, allowlisted), and:
`WAITING ON owner: run git config core.hooksPath .githooks in the reach-radio repo (shared by all its worktrees; Yes/No; mention any hook found in Step 3)`. After the branch merges to main, `npm install` in any checkout also activates the hooks through `prepare`; hooks are git hooks, so no session restart is needed.
