# Retro: reach-radio gates, Tier 3 (2026-11-16)

## What was done
- Audit Tier 3: murex had no git hooks, no CI, no commitlint. Owner narrowed scope to pre-push only (no CI), committed `.githooks` plus `core.hooksPath` via npm `prepare`, and all three rule checks. Spec `abed32a`, plan `2f1fc91`.
- Child (sonnet coordinator, haiku implementers) built it in 8 commits (`1a16740`..`e9f675f`): 5 jsx-a11y fixes plus recommended rules on, TS-AST UI-rule scan test (5 real `cursor-pointer` violations fixed, 0 allowlisted), pre-push hook (lint, typecheck, test), commit-msg hook, commitlint with the 15 scopes, shell test with stub npm.
- Orchestrator re-ran independently: lint, typecheck clean; 473/473 tests; `test-githooks.sh` ALL PASS; `harness-build` receipt written. Not pushed; `core.hooksPath` still unset (owner-gated).
- Dogfooded Tier 2: `orch-ledger start`, `set`, `claim` on this branch (nodes `eb37ed9`, `4ace26c`).

## What worked
- Measuring baselines before planning (lint and tsc clean, exactly 5 a11y violations) meant the gate never blocks on old debt.
- Advisor pass caught two blockers before any code ran: `npm install` would run `prepare` and set the shared `core.hooksPath` mid-plan (fixed with `--ignore-scripts`), and the plan never checked the commands the hook really runs (`npm run lint` is bare `eslint`, whole repo).
- Pre-approving chmod, commits, `npm install --ignore-scripts` and the Doppler build in the dispatch prompt: no sandbox stall this time (Tier 2 retro lesson applied).
- Positive controls in the UI-rule test and a skip-path test for commit-msg.

## What did not
- Child skipped the sonnet per-task and final reviews and relied on its own re-runs; orchestrator re-verified, but the brief's review step was not honored.
- Stop hooks fired while the child still ran: SP1 (node `running` with commits) and the build-receipt gate each blocked a turn. Both were correct but noisy mid-delegation.
- Resource guard queued the Doppler build behind another build (ticket t007813).
- Stubbed `npx` hid a real bug: `npx --no commitlint --edit` makes npx swallow `--edit`, so commitlint got no input and every commit failed once `core.hooksPath` went live. Found only by the first real commit; fixed in `ec3c0bb` (call `node_modules/.bin/commitlint` directly) and the test now stubs the binary and runs the real hook end to end.
- shellcheck was not installed until the owner approved it; it then found 1 info item (SC2015), fixed.

## Root causes (blameless)
- Plans describe review steps as prose; nothing forces a coordinator to dispatch them or say it skipped them.
- The UI-rule scanner reads literal `className` text, so classes from shared constants are invisible; it flagged 5 sites that already rendered `cursor-pointer`.
- `package-lock.json` diff is large (606+/126-) because npm rewrote `libc` fields on existing entries, not because packages were dropped.
- Orchestrator-side gates (SP1, build receipt) have no "delegated child running" exemption.

## Changes codified this turn
- None in always-loaded config (`~/.claude/CLAUDE.md` is at 17321/17500 bytes). Lessons recorded here and as action items.

## Enforcement map
| Lesson | Mechanism | Wired and live? |
|---|---|---|
| Lint, typecheck, tests before push | `.githooks/pre-push` | Live since 2026-11-16 (`core.hooksPath` set); commit-msg proven by a real commit, pre-push not yet exercised on a real push |
| Canonical commit scopes | `.githooks/commit-msg` + `commitlint.config.mjs` | Live; real commit accepted |
| UI rules (cursor-pointer, motion-safe, aria-label) | `tests/unit/ui-rules.test.ts` | Live: runs in `npm test` and the pre-push hook |
| a11y rules | jsx-a11y recommended in `eslint.config.mjs` | Live: runs in `npm run lint` |
| Hooks installed on every checkout | npm `prepare` (`|| true`) | Runs on next `npm install` after merge to main |
| Hook scripts lint-clean | shellcheck | Nothing: not installed (owner Yes/No) |

## Action items
- [x] owner | now | hooksPath activated 2026-11-16, verified: first real commit passed the live commit-msg hook (`ec3c0bb`)
- [x] owner | before push | Yes/No: push 12 unpushed commits via merge to main then `git push origin main` (deploys) | done when origin/main has them and apex host probed (2026-11-17: done: origin/main at ddeb051 (merge), apex https://reach.radio returned HTTP 200)
- [x] me | next plan | add plan-checklist item: a review step in a plan must be dispatched or reported as skipped, and delegated-child runs need a note that SP1/build gates may fire mid-run | done 2026-11-16: item 12 is in `~/.claude/docs/claude-md-reference.md`
- [x] me | next UI-rule change | teach `ui-rules.test.ts` to resolve same-file class constants, or document the blind spot in the test header | done when a constant-based button is flagged or the header says so (header done)
- [x] owner | shellcheck installed and clean on hooks and test

## Pruned
- Nothing removed; no always-loaded text added.
