# Reach Radio gates: local pre-push, a11y lint, UI-rule scan, commitlint (Tier 3)

Date: 2026-11-16. Status: design approved by owner in session; awaiting spec review.

## Goal

Make the rules in `AGENTS.md` (UI rules, a11y rules, canonical commit scopes) and the lint/type/test baseline machine-enforced and repeatable, instead of prose that a session may forget. Today murex has no git hooks, no CI, no commitlint. `npx eslint src` and `npx tsc --noEmit` both pass clean on 2026-11-16 (baseline measured).

## Decisions (owner, 2026-11-16)

- Gate location: local pre-push only. No GitHub Actions in this tier. Known limit: `--no-verify`, a machine without the hook, or a GitHub web-editor push is ungated.
- Hook install: committed `.githooks/` plus `core.hooksPath` set by an npm `prepare` script. No husky, no lint-staged.
- Rule checks: UI-rule class-scan test, more `jsx-a11y` rules in eslint, commitlint with the scope enum.

## Non-goals

- No CI workflow. No `next build` in the hook (slow, needs Doppler; the repo harness already runs the build as a Stop gate).
- No new always-loaded text (`~/.claude/CLAUDE.md` is at 17321 of 17500 bytes).
- No Playwright e2e in the hook.

## Pieces

### 1. Pre-push hook
`.githooks/pre-push` (bash, committed, executable). Reads the pushed ref ranges from stdin; if no changed file matches `src/`, `tests/`, `eslint.config.*`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, exits 0 immediately (docs-only pushes stay instant). Otherwise runs, in order, stopping at the first failure: `npm run lint`, `npm run typecheck`, `npm test`. Prints the failing command and exits 1. New-branch pushes (all-zero remote sha) are diffed against `origin/main`.

### 2. Install
`package.json`: `"prepare": "git config core.hooksPath .githooks"`, `"typecheck": "tsc --noEmit"`. `core.hooksPath` lives in the shared git config, so every Orca worktree and clone of the repo is covered after one `npm install` (or one manual run of the git config line for existing checkouts).

### 3. More jsx-a11y rules
`eslint.config.mjs` extended with the `jsx-a11y` recommended rule set (plugin already installed through `eslint-config-next`). Order matters: measure violations first, fix them in the same plan, and only then turn the rules on as errors, so the hook never blocks on old debt.

### 4. UI-rule class-scan test
`tests/unit/ui-rules.test.ts`, modelled on `tests/unit/contrast-classes.test.ts`. Scans `src/components/**` for: every `<button`, `onClick` or `role="button"` element has `cursor-pointer`; every `animate-` class has `motion-safe:`; every icon-only button has `aria-label`. Existing violations are fixed first, or listed on a short named allowlist with a reason, measured before the test lands.

### 5. commitlint
Dev dependencies `@commitlint/cli` and `@commitlint/config-conventional`; `commitlint.config.mjs` with `scope-enum` set to the 15 canonical scopes from `AGENTS.md` (bridge, seo, teachers, schedule, theme, modal, player, sleep-timer, donate, about, layout, api, global, ppr, test) and `scope-empty` allowed. `.githooks/commit-msg` runs `npx --no commitlint --edit "$1"`. Makes the repo-harness commit-scope warning a hard local check.

## Testing

- Hook: shell test on a fixture repo with a stub `npm`: docs-only push skipped; src change runs the three commands; a failing command blocks with exit 1; new-branch sha handled.
- commitlint: accepts `fix(teachers): x`, rejects `fix(Teachers): x` and an undocumented scope.
- UI-rule test: positive control (a fixture string with a violation is flagged) and the real scan passes.
- Whole existing suite stays green; `npm run lint` and `npm run typecheck` stay clean.

## Risks and limits (accepted)

- A gate that blocks on old debt gets bypassed with `--no-verify`; hence measure and clear before enabling each rule.
- Pre-push adds the lint, tsc and test run time to code pushes; docs-only pushes are exempt.
- No off-machine backstop in this tier. CI can be added later as its own piece.
