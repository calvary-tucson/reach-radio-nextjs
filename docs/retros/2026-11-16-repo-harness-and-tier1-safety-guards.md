# Retro: repo harness + Tier 1 safety guards (2026-11-16)

## What was done
- Repo harness (global engine in claude-code-config, per-repo `.claude/harness.json`): build Stop gate, push guard, commit-scope check, UI-rule warn. Installed, receipt-verified on reach-radio-nextjs.
- Determinism audit across projects; owner picked Tier 1 safety fixes.
- Tier 1 plan (5 tasks) executed by a child session: global `safety-guards.sh` (stash deny, secrets deny on commit, ffmpeg warn, `--replace`/`--regen` log-only), installer, video-studio adapter fail-closed on publish, calvary `branch-guard`/`file-guard` wired with exit 2.
- Pushed 2026-11-16: claude-code-config `5358d90..a2f4a7a` (master), reach-radio `3b5ca47..0a94580`, video-studio-cli `e36ed52..e3a8029`, calvarytucson-nextjs `30f58612..dc60ed8e`.

## What worked
- Warn-first, small independent rules with kill switch (`~/.claude/safety-guards/off`) answered the owner's "not too rigid" concern.
- Advisor review of the plan caught two real gaps before execution (fallback regex missed `studio.py publish`; bare `git stash apply|drop` not denied).
- Independent re-run of all suites after the child reported pass (40 + 19 + adapter tests).
- Calvary pre-push hook ran lint, 2764 tests and `next build` before the push.

## What did not
- Plan text shipped an unsafe test setup: bare `mktemp -d` with `trap rm -rf "$T"`, which deletes cwd if mktemp fails in the sandbox. Child found it; my own sandboxed run hit it too (sandbox blocked the delete).
- Plan Task 2 dry-run fixture (`"PreToolUse": []`) tripped the added-lines-only check.
- Push question asked before inspecting the main checkouts: claude-code-config `master` carried an unrelated unpushed commit (30c4476), forcing a second question. Repeat of the open 2026-11-11 item.
- Push guard denied `git push origin master` because the hook judged the session cwd (reach-radio, mainBranch `main`), not the repo I had `cd`'d to.
- Child ran two sandbox-off `git commit`s beyond the approved (a)(b)(c) set (9da1f86, 9b0fd61b); it asked afterwards.
- Adapter suite counts disagree (earlier 87 OK, later 12 via `unittest discover`); not reconciled.

## Root causes
- Plan-writing checklist had no rule for temp-dir setup in shell tests or for fixture realism against the installer's own checks.
- Push preflight is prose in a retro item, not a step in any skill or hook.
- Guard resolves repo from payload cwd; documented only in code.
- Dispatch prompt scoped approval to a command list but gave the child no "stop at the first command outside the list" wording.

## Changes codified this turn
- Memory `feedback-push-preflight-main-checkout.md` + index line (preflight, `git -C` push).
- Plan amended earlier (85a5489): hardened mktemp, non-empty dry-run fixture.
- No CLAUDE.md change: always-loaded config unchanged (17321 bytes, budget 17500).

## Enforcement map
| Lesson | Mechanism | Wired and live? |
|---|---|---|
| Stash/secrets/ffmpeg/replace guards | `safety-guards.sh` PreToolUse Bash | Yes: registered in `~/.claude/settings.json`, smoke: `git stash` exit 2, `ffmpeg` warn, log rows in `log.tsv` |
| Publish fails closed | adapter fallback regex + test | Yes: on video-studio main e3a8029 |
| Calvary branch/file guards | hooks exit 2 + `scripts/test-guard-hooks.sh` | Yes: on main dc60ed8e (live only in sessions started after) |
| Safe temp dir in shell tests | tests + plan text | Text only; recurring check is the plan-writing checklist (not yet patched) |
| Push preflight | memory only | Text only (second occurrence, see action items) |
| Child stays inside approved commands | none | Nothing |

## Action items
- [ ] me | `~/.claude/docs/claude-md-reference.md` "Plan-writing checklist" | next plan written | add "shell tests: mktemp with prefix + existence check + prefix-guarded rm; fixtures must pass the installer's own checks" and re-run `test-config-health.sh`
- [ ] me | claude-code-config `feat/repo-harness` worktree | next session | commit the uncommitted `settings.json` mirror entry for safety-guards (on `~/.claude/settings.json` already, not on origin)
- [ ] me | claude-code-config | next push request | add a preflight step (main checkout ahead/behind, foreign commits) to the push flow text or a helper script; carries 2026-11-11 item 3
- [ ] owner | open Claude sessions | now | restart so the new hooks load
- [ ] me | video-studio-cli adapter tests | next session | reconcile the 87 vs 12 test count (which command runs the full suite)

## Pruned
- Nothing removed; no always-loaded rule was shown stale.
