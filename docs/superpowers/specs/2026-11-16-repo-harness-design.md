# Repo harness: global engine, per-repo rules

Date: 2026-11-16. Status: design approved by owner in session, awaiting spec review.

## Goal

Make "verified before done/push" deterministic instead of advisory. Prose rules
(CLAUDE.md, AGENTS.md, memory) failed on 2026-11-13: tsc, eslint and vitest passed,
`next build` failed on Vercel (cacheComponents 204). Enforce with hooks.

Logic is global and tested once. Each repo declares its own rules as data.

## Non-goals

- No Agent SDK state machine.
- No CI workflow in v1 (hooks only cover Claude sessions on this machine; CI is a later follow-up).
- No env-var bypass. Overrides mean editing the repo JSON.

## Where things live

- Engine: `claude-code-config/hooks/repo-harness/`, installed by `apply-repo-harness.sh`.
  The owner reads the diff first. Registering hooks in `settings.json` needs a
  Yes/No naming the exact lines (back up to `$TMPDIR`, edit only those lines, verify `jq -e .`).
- Rules: `<repo>/.claude/harness.json`, committed. Missing file means every hook is a no-op.
- User and project hook entries merge (official hooks reference), so no conflict with existing global hooks.
- Tests: `claude-code-config/hooks/tests/`, shell, against a throwaway fixture repo.

## Schema v1

```json
{
  "buildGate": {
    "cmd": "doppler run --project reach-radio-nextjs --config dev -- npx next build",
    "paths": ["src/app/**", "next.config.*", "package.json"]
  },
  "pushFlow": { "mainBranch": "main", "blockFeaturePush": true },
  "commitScopes": ["bridge","seo","teachers","schedule","theme","modal","player",
                   "sleep-timer","donate","about","layout","api","global","ppr","test"],
  "uiRules": [
    { "glob": "src/components/**", "when": "<button|onClick", "mustHave": "cursor-pointer" }
  ]
}
```

## Components

### lib.sh
Find git toplevel (works in Orca worktrees), load JSON with `jq`, compute the tree key,
read and write receipts. Internal errors fail open and are logged. Gate decisions fail closed.

### Tree key
Content hash of the working state: temp `GIT_INDEX_FILE` in `$TMPDIR`, `git read-tree HEAD`,
`git add -A`, `git write-tree`. A clean tree equals `HEAD^{tree}`, so committing does
not invalidate a receipt; any edit does. Verified to work inside the sandbox. No stash use.

### harness-build (the only receipt path)
Wrapper, symlinked into `~/.local/bin` like `rg-run`. Runs `buildGate.cmd` in the
foreground (through `rg-run --class build`), and on exit 0 writes a receipt
`{key, cmd, time}` into `$(git rev-parse --git-common-dir)/harness/`.
- **Common dir, not git dir.** `--git-dir` is per-worktree (`.git/worktrees/<id>`), so a
  worktree receipt would be invisible to the push guard in the main checkout. The common
  dir is shared and is writable from sandboxed Bash (verified).
- Claude and the owner both run it, so the owner's `! harness-build` counts (a bare `!`
  run fires no hooks).
- The build itself needs the sandbox off (doppler); the wrapper is run that way.
- Never run it with `run_in_background`; the wrapper must exit 0 before the receipt exists.
- Running the raw `doppler ... next build` directly writes no receipt. By design: the gate
  then asks for `harness-build`. No PostToolUse receipt hook: the Bash `tool_response` has
  no exit-code field and background timing is undocumented, so it cannot be trusted.

### Threat model
Guards against accidental misses, not an adversarial model. Hand-writing a receipt is
blocked by a PreToolUse deny on Bash/Edit/Write targeting `*/.git/harness/*`
(same pattern as `block-shell-source-edit`). Owner kill switch: file
`~/.claude/harness/off` (like resource-guard's `off`); there is no env-var bypass.

### stop-gate.sh (Stop)
Block when the change set touches `buildGate.paths` and no receipt matches the current key.
- Change set = `merge-base HEAD <mainBranch>` diff plus working-tree and untracked files
  (so committing first cannot dodge the gate).
- Exit 0 immediately if `stop_hook_active` is true.
- Fire at most once per tree key.
- Skip when `last_assistant_message` ends with a question or contains `WAITING ON`
  (orchestrated children that need the owner for a sandbox-off build end that way).
- Shares the 8-consecutive-continuation cap with `next-me-check`.
- Block reason names the exact `harness-build` command.
- **Strength, stated honestly:** the Stop gate is a one-shot forced retry, not a wall.
  Claude can ignore it once and the second stop passes. The hard gate is the push guard.
  Once-per-key is deliberate: blocking forever risks a stuck session when the build
  cannot run (queued, owner away).
- Triggers only when the change set touches `buildGate.paths`, so docs-only and
  research sessions are never blocked.

### push-guard.sh (PreToolUse Bash, `git push`)
- Deny a feature-branch push (`blockFeaturePush`). Exit 2 with the reason on stderr.
- When the pushed commits touch `buildGate.paths`, require a receipt whose key equals the
  tree of the commit being pushed (owner decision 2026-11-16). After the `--no-ff` merge in
  the main checkout this forces one rebuild there, so what ships is what was built.
- Resolve what is pushed from the command: `git push`, `git push origin main`,
  `HEAD:main`, `--force`. Source ref's tree via `git rev-parse <src>^{tree}`. Always deny
  `--force`/`--force-with-lease` to the main branch. A push form the parser cannot
  resolve is denied with the reason (fail closed), not guessed.
- Runs bare; piped or compound push commands are already a known auth problem.
- The tree is read in the main checkout; the receipt comes from the shared common dir, so a
  worktree build counts only if the merged tree is byte-identical, otherwise rebuild.

### commit-scope.sh (PreToolUse Bash, `git commit`)
- A scope, if present, must be in `commitScopes`. No scope is allowed.
- Merge commits exempt.
- `a11y` and `security` are NOT on the list (AGENTS.md: a11y fixes use the component scope).
  Existing history is grandfathered because the check only sees new commits.
- Complements the existing global `commit-format.sh` (type prefix); does not replace it.

### ui-rules.sh (PostToolUse Edit|Write)
Grep `uiRules` on the edited file and warn (never block) with the missing class.
Alternative considered: a sibling unit test next to `tests/unit/contrast-classes.test.ts`,
which also runs outside Claude. Not chosen for v1; revisit if the grep false-positives.

## Data flow

1. Edit route file. 2. `harness-build` passes, receipt written for the tree key.
3. Edit again: key changes, receipt void. 4. Stop gate blocks until a new `harness-build`.
5. Commit and merge to main. 6. Push guard compares the pushed tree to a receipt; missing
means deny with "run harness-build in the main checkout".

## Performance and contract

- Tree key measured at 0.27 s on this repo (temp index, `git add -A`). Budget: every
  hook under 1 s on a route-touching change, a no-op under 50 ms with no config.
- Plan step 0: capture real Stop, PreToolUse and PostToolUse payloads from a live session
  into fixtures, so tests match the harness and not the docs. Hook tests must use them.

## Testing

Fixture-repo shell tests: no config is a no-op; receipt valid then voided by an edit;
commit after build keeps the receipt valid; Stop blocks once and not on `stop_hook_active`;
Stop skips on `WAITING ON`; push blocked on a feature branch and on a missing receipt,
allowed with a matching one; scope accept, reject, absent, merge-exempt; UI rule warns.
Config-health size budget in `hooks/tests/test-config-health.sh` must stay green.

## Rollout

1. Engine and tests in claude-code-config. 2. `apply-repo-harness.sh`, owner reads diff.
3. `settings.json` Yes/No. 4. reach-radio-nextjs `harness.json`. 5. Other repos opt in later.
Plan then executes in a child session per owner rule (sonnet coordinator, haiku implementers).

## Known limits (accepted)

- Hooks run only in Claude sessions on this machine. A push from a plain terminal or
  another tool bypasses them. CI is the off-machine gate and is a follow-up, not v1.
- Receipt proves a build passed for that tree and command, not that the route table was
  read. The "route shows ƒ Dynamic" check stays a human step in the push question.
- UI grep rules are heuristic and warn only.

## Open items

None blocking. `package-lock.json` shows modified in this worktree (not caused by this
work); check before the next commit.
