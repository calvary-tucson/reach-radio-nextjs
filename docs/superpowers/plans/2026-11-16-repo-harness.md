# Repo Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Global, tested hook engine that reads per-repo `.claude/harness.json` and enforces a build receipt before "done" (Stop gate) and before `git push` (push guard), plus commit-scope and UI-class checks.

**Architecture:** Bash hooks in `claude-code-config/hooks/repo-harness/` sharing one `lib.sh`. `harness-build` runs the repo's build command and writes a receipt keyed by a content hash of the working tree into `<git-common-dir>/harness/`. Stop gate and push guard compare the current tree (or pushed commit's tree) to a receipt. No config file in a repo means every hook is a no-op.

**Tech Stack:** bash 3.2 (macOS), `jq`, `git` (>= 2.31 for `--path-format=absolute`), synthetic bash tests in `hooks/tests/`.

Spec: `docs/superpowers/specs/2026-11-16-repo-harness-design.md` (reach-radio-nextjs, branch `calvary-tucson/research-claude-code-harnesses`).
Offload check: n/a, dev tooling only; no route, poll, stream, cron, search API, image or media path changes.

## Global Constraints

- Engine lives in `/Users/danielmccauley/Documents/Development/claude-code-config` (call it `CCC`). Work in a worktree of that repo created by the dispatching session (`orca worktree create --repo`, `--base-branch main`). All paths below in Tasks 1-6 and the apply script are relative to the worktree root. Task 7 step 7 touches the reach-radio-nextjs worktree.
- Hook dir: `hooks/repo-harness/`. Tests: `hooks/tests/test-repo-harness-*.sh`, run as `bash hooks/tests/<file>`, each prints `<NAME> PASS` or `<NAME> FAIL` and exits non-zero on failure.
- Stop hook output is `{"decision":"block","reason":"..."}` on stdout, exit 0 (precedent: `hooks/next-me-check/next-me-check.sh`). PreToolUse deny is exit 2 with the reason on stderr (precedent: `hooks/commit-format.sh`). PostToolUse warning is exit 2 with stderr (tool already ran).
- Every gate honors the owner kill switch file `${HARNESS_HOME:-$HOME/.claude/harness}/off`. No env-var bypass.
- Fail open on internal errors (missing `jq`, git failure); fail closed on a gate decision.
- Hooks must not read or write anything outside: the repo, `$TMPDIR`, `<git-common-dir>/harness/`, `${HARNESS_HOME}`.
- `set -u` in every script; bash 3.2 compatible (no `mapfile`, no associative arrays, guard empty arrays with `${#a[@]}`).
- Commits: conventional, small, plain `git add <paths>` then `git commit -m "..." -- <paths>` as standalone commands; never amend/reset; Edit/Write tools only, no inline scripts to edit files. Scope for this repo's own commits is `chore`/`feat`/`test` with no scope.
- Never push. Owner-gated steps (marked OWNER-GATED) are roll-ups to the owner as Yes/No; a child ends its turn with `WAITING ON owner: <ask>`.
- Never `git stash`. Tests use temp dirs under `$TMPDIR` only.
- Memory: scripts handle file lists only; fixtures are tiny. No media or large data.

## File Structure (all in CCC worktree unless noted)

| File | Responsibility |
|---|---|
| `hooks/repo-harness/lib.sh` | Sourced helpers: config lookup, tree key, receipts, change set, glob match, kill switch |
| `hooks/repo-harness/harness-build` | Executable wrapper: run build cmd, write receipt on exit 0 |
| `hooks/repo-harness/stop-gate.sh` | Stop hook: block once per tree key when build paths changed and no receipt |
| `hooks/repo-harness/push-guard.sh` | PreToolUse(Bash) `git push` guard |
| `hooks/repo-harness/commit-scope.sh` | PreToolUse(Bash) `git commit` scope allowlist |
| `hooks/repo-harness/receipt-guard.sh` | PreToolUse(Bash/Write/Edit) deny hand-writing receipts |
| `hooks/repo-harness/pre-tool.sh` | One dispatcher registered for PreToolUse; runs the three guards in order |
| `hooks/repo-harness/ui-rules.sh` | PostToolUse(Edit/Write) UI class warnings |
| `hooks/apply-repo-harness.sh` | Owner-run installer: copy hooks, symlink `harness-build`, register in settings |
| `hooks/tests/lib-harness-fixture.sh` | Sourced test helpers: temp dir, fixture repo, `chk` |
| `hooks/tests/test-repo-harness-{lib,build,stop,push,pre,ui,apply}.sh` | One test file per task |
| reach-radio-nextjs `.claude/harness.json`, `.gitignore` | Repo rules (Task 7) |

---

### Task 1: lib.sh and test fixture

**Files:**
- Create: `hooks/repo-harness/lib.sh`
- Create: `hooks/tests/lib-harness-fixture.sh`
- Test: `hooks/tests/test-repo-harness-lib.sh`

**Interfaces:**
- Produces (all in `lib.sh`, sourced): `hx_off`, `hx_root <dir>`, `hx_cfg_file <dir>`, `hx_glob_to_re <glob>`, `hx_any_match <glob>...` (reads file list on stdin, rc 0 if any match), `hx_tree_key <root> [commit]` (prints tree sha; working state when no commit), `hx_receipt_dir <root>`, `hx_write_receipt <root> <key> <cmd>`, `hx_has_receipt <root> <key> <cmd>`, `hx_changed_files <root> <mainBranch>`.
- Produces (fixture): `T` (temp dir), `chk <name> <got> <want>`, `mk_repo <dir>` (repo on branch `main`, one commit, committed `.claude/harness.json`), `done_ <NAME>`.

- [ ] **Step 1: Write the fixture helper**

Create `hooks/tests/lib-harness-fixture.sh`:

```bash
# Sourced by test-repo-harness-*.sh. Needs H=<path to hooks/repo-harness> set by the caller.
# Purpose: temp dir + fixture repo + chk helper. Writes only under $TMPDIR. Never touches real ~/.claude.
T="$(cd "$(mktemp -d "${TMPDIR:-/tmp}/hx.XXXXXX")" && pwd -P)"; trap 'rm -rf "$T"' EXIT  # pwd -P: macOS tmp is a symlink; git returns physical paths
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export HARNESS_HOME="$T/home" HARNESS_NO_RG=1 AWAY_DIR="$T/away"
fail=0
chk() { [ "$2" = "$3" ] || { echo "FAIL $1: got '$2' want '$3'"; fail=1; }; }
mk_repo() {
  local r="$1"
  git init -q -b main "$r"
  mkdir -p "$r/src/app" "$r/src/components" "$r/.claude" "$r/docs"
  cat > "$r/.claude/harness.json" <<'JSON'
{
  "buildGate": { "cmd": "echo built", "paths": ["src/app/**", "next.config.*"], "ignore": ["gen.txt"] },
  "pushFlow": { "mainBranch": "main", "blockFeaturePush": true },
  "commitScopes": ["bridge", "seo", "teachers", "ppr", "test"],
  "uiRules": [
    { "glob": "src/components/**", "when": "<button|onClick", "mustHave": "cursor-pointer" }
  ]
}
JSON
  echo 'export const a = 1' > "$r/src/app/page.ts"
  echo hi > "$r/docs/a.md"
  git -C "$r" add -A
  git -C "$r" commit -qm "chore: init"
}
done_() { [ "$fail" = 0 ] && echo "$1 PASS" || { echo "$1 FAIL"; exit 1; }; }
```

- [ ] **Step 2: Write the failing test**

Create `hooks/tests/test-repo-harness-lib.sh`:

```bash
#!/bin/bash
# Synthetic test for hooks/repo-harness/lib.sh (temp repos only, no network).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; H="${REPO_HARNESS_DIR:-$HERE/../repo-harness}"
. "$HERE/lib-harness-fixture.sh"
. "$H/lib.sh"
R="$T/r"; mk_repo "$R"
CMD="echo built"

# config lookup
mkdir -p "$T/plain"; git init -q "$T/plain"
chk "no cfg returns nothing" "$(hx_cfg_file "$T/plain")" ""
chk "cfg found" "$(hx_cfg_file "$R")" "$R/.claude/harness.json"
chk "cfg found from subdir" "$(hx_cfg_file "$R/src/app")" "$R/.claude/harness.json"

# kill switch
hx_off && { echo "FAIL off should be false"; fail=1; }
mkdir -p "$HARNESS_HOME"; : > "$HARNESS_HOME/off"; hx_off || { echo "FAIL off should be true"; fail=1; }
rm -f "$HARNESS_HOME/off"

# glob match
printf 'src/app/a/b.ts\n' | hx_any_match 'src/app/**'; chk "deep glob" "$?" 0
printf 'docs/a.md\n' | hx_any_match 'src/app/**' 'next.config.*'; chk "no match" "$?" 1
printf 'next.config.ts\n' | hx_any_match 'src/app/**' 'next.config.*'; chk "second glob" "$?" 0
printf 'src/app.ts\n' | hx_any_match 'src/app/**'; chk "prefix is not dir" "$?" 1

# tree key: stable, edit changes, commit keeps it, equals HEAD tree
k1="$(hx_tree_key "$R")"; k2="$(hx_tree_key "$R")"
chk "key stable" "$k1" "$k2"
chk "key equals HEAD tree when clean" "$k1" "$(git -C "$R" rev-parse 'HEAD^{tree}')"
echo "// edit" >> "$R/src/app/page.ts"
kd="$(hx_tree_key "$R")"
[ "$kd" != "$k1" ] || { echo "FAIL edit did not change key"; fail=1; }
git -C "$R" commit -qam "feat: edit"
chk "commit keeps key" "$(hx_tree_key "$R")" "$kd"
chk "key for commit arg" "$(hx_tree_key "$R" HEAD)" "$kd"
: > "$R/gen.txt"
chk "ignored path does not change key" "$(hx_tree_key "$R")" "$kd"
: > "$R/src/app/new.ts"
[ "$(hx_tree_key "$R")" != "$kd" ] || { echo "FAIL untracked file ignored by key"; fail=1; }
rm -f "$R/src/app/new.ts" "$R/gen.txt"

# receipts
key="$(hx_tree_key "$R")"
hx_has_receipt "$R" "$key" "$CMD"; chk "no receipt yet" "$?" 1
hx_write_receipt "$R" "$key" "$CMD"
hx_has_receipt "$R" "$key" "$CMD"; chk "receipt found" "$?" 0
hx_has_receipt "$R" "$key" "other cmd"; chk "cmd mismatch" "$?" 1
hx_has_receipt "$R" "deadbeef" "$CMD"; chk "other key" "$?" 1
git -C "$R" worktree add -q "$T/wt" -b wt
hx_has_receipt "$T/wt" "$key" "$CMD"; chk "receipt visible from worktree (common dir)" "$?" 0
case "$(hx_receipt_dir "$R")" in "$R/.git/harness") ;; *) echo "FAIL receipt dir: $(hx_receipt_dir "$R")"; fail=1;; esac

# changed files: branch from main with a commit, a working edit and an untracked file
git -C "$R" checkout -q -b feat
echo "// c" >> "$R/src/app/page.ts"; git -C "$R" commit -qam "feat: c"
echo more >> "$R/docs/a.md"
echo n > "$R/docs/new.md"
files="$(hx_changed_files "$R" main)"
case "$files" in *src/app/page.ts*) ;; *) echo "FAIL missing committed change"; fail=1;; esac
case "$files" in *docs/a.md*) ;; *) echo "FAIL missing working change"; fail=1;; esac
case "$files" in *docs/new.md*) ;; *) echo "FAIL missing untracked"; fail=1;; esac
done_ "REPO HARNESS LIB"
```

Note on `git checkout -q -b feat` above: `feat` branches from the current `main` HEAD which already contains the "feat: edit" commit, so only the later commit counts as committed-since-base.

- [ ] **Step 3: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-lib.sh`
Expected: FAIL, `hooks/repo-harness/lib.sh: No such file or directory` (non-zero exit).

- [ ] **Step 4: Write lib.sh**

Create `hooks/repo-harness/lib.sh`:

```bash
#!/bin/bash
# Sourced by repo-harness scripts. Never run directly.
# Purpose: shared helpers for the repo harness (config, tree key, receipts, change set, globs).
# Reads: <repo>/.claude/harness.json, git state. Writes: only hx_write_receipt -> <git-common-dir>/harness/<key>.
# Memory: file lists only (bounded by repo file count).
# Note: hx_tree_key writes git objects (blobs/trees) to the repo object DB through a temp index; never touches the real index.

hx_off() { [ -e "${HARNESS_HOME:-$HOME/.claude/harness}/off" ]; }

hx_root() { git -C "${1:-.}" rev-parse --show-toplevel 2>/dev/null; }

# Prints the harness.json path, rc 0 only when it exists.
hx_cfg_file() {
  local r; r="$(hx_root "${1:-.}")"
  [ -n "$r" ] && [ -f "$r/.claude/harness.json" ] && printf '%s' "$r/.claude/harness.json"
}

hx_glob_to_re() {
  printf '%s' "$1" | sed -e 's/[.+^$(){}|]/\\&/g' -e 's/\*\*/@@DS@@/g' -e 's/\*/[^\/]*/g' -e 's/@@DS@@/.*/g'
}

# stdin: file list, one per line. args: globs. rc 0 if any file matches any glob.
hx_any_match() {
  local files g re; files="$(cat)"
  for g in "$@"; do
    re="^$(hx_glob_to_re "$g")\$"
    printf '%s\n' "$files" | grep -Eq "$re" && return 0
  done
  return 1
}

# hx_tree_key <root> [commit]: tree sha of the working state (or of <commit>), minus buildGate.ignore pathspecs.
hx_tree_key() {
  local root="$1" commit="${2:-}" tmp key cfg
  tmp="$(mktemp -u "${TMPDIR:-/tmp}/hx-idx.XXXXXX")" || return 1
  cfg="$root/.claude/harness.json"
  key="$(
    cd "$root" || exit 1
    export GIT_INDEX_FILE="$tmp"
    if [ -n "$commit" ]; then
      git read-tree "$commit" 2>/dev/null || exit 1
    else
      git read-tree HEAD 2>/dev/null
      git add -A >/dev/null 2>&1 || exit 1
    fi
    if [ -f "$cfg" ]; then
      jq -r '.buildGate.ignore[]? // empty' "$cfg" 2>/dev/null | while IFS= read -r ex; do
        [ -n "$ex" ] && git rm -q --cached -r --ignore-unmatch -- "$ex" >/dev/null 2>&1
      done
    fi
    git write-tree 2>/dev/null
  )"
  rm -f "$tmp"
  [ -n "$key" ] && printf '%s' "$key"
}

hx_receipt_dir() {
  local c; c="$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 1
  [ -n "$c" ] && printf '%s/harness' "$c"
}

hx_write_receipt() {
  local d; d="$(hx_receipt_dir "$1")" || return 1
  mkdir -p "$d" || return 1
  jq -nc --arg k "$2" --arg c "$3" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{key:$k,cmd:$c,time:$t}' > "$d/$2"
}

hx_has_receipt() {
  local d f; d="$(hx_receipt_dir "$1")" || return 1
  f="$d/$2"
  [ -f "$f" ] && [ "$(jq -r '.cmd // empty' "$f" 2>/dev/null)" = "$3" ]
}

# hx_changed_files <root> <mainBranch>: changed vs merge-base, plus working-tree and untracked files.
hx_changed_files() {
  local root="$1" main="$2" base cur
  base="$(git -C "$root" merge-base HEAD "$main" 2>/dev/null)"
  cur="$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null)"
  if [ "$cur" = "$main" ] && git -C "$root" rev-parse -q --verify "origin/$main" >/dev/null 2>&1; then
    base="$(git -C "$root" merge-base HEAD "origin/$main" 2>/dev/null)"
  fi
  {
    [ -n "$base" ] && git -C "$root" diff --name-only "$base" HEAD
    git -C "$root" diff --name-only HEAD
    git -C "$root" ls-files -o --exclude-standard
  } 2>/dev/null | sort -u
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bash hooks/tests/test-repo-harness-lib.sh`
Expected: `REPO HARNESS LIB PASS`. If a `FAIL` line shows, fix `lib.sh` (not the test) unless the test contradicts a spec line.

- [ ] **Step 6: Commit**

```bash
git add hooks/repo-harness/lib.sh hooks/tests/lib-harness-fixture.sh hooks/tests/test-repo-harness-lib.sh
git commit -m "feat: add repo-harness lib (config, tree key, receipts, change set)" -- hooks/repo-harness/lib.sh hooks/tests/lib-harness-fixture.sh hooks/tests/test-repo-harness-lib.sh
```

---

### Task 2: harness-build wrapper

**Files:**
- Create: `hooks/repo-harness/harness-build`
- Test: `hooks/tests/test-repo-harness-build.sh`

**Interfaces:**
- Consumes: `hx_cfg_file`, `hx_root`, `hx_tree_key`, `hx_write_receipt`, `hx_has_receipt` from `lib.sh`.
- Produces: executable `harness-build` (no args; run from inside a repo). Exit 0 = build passed and receipt written; exit 2 = no config or no `buildGate.cmd`; exit 3 = tree changed during build (no receipt); any other = the build's own exit code (no receipt). Uses `rg-run --class build --label harness-build -- sh -c "<cmd>"` when `rg-run` exists and `HARNESS_NO_RG` is not `1`.

- [ ] **Step 1: Write the failing test**

Create `hooks/tests/test-repo-harness-build.sh`:

```bash
#!/bin/bash
# Synthetic test for hooks/repo-harness/harness-build.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; H="${REPO_HARNESS_DIR:-$HERE/../repo-harness}"
. "$HERE/lib-harness-fixture.sh"
. "$H/lib.sh"
R="$T/r"; mk_repo "$R"
setcmd() { jq --arg c "$1" '.buildGate.cmd=$c' "$R/.claude/harness.json" > "$T/h.json" && cp "$T/h.json" "$R/.claude/harness.json"; }

# happy path
( cd "$R" && bash "$H/harness-build" >"$T/out" 2>&1 ); chk "pass exit" "$?" 0
key="$(hx_tree_key "$R")"
hx_has_receipt "$R" "$key" "echo built"; chk "receipt written for tree" "$?" 0
# edit voids it
echo "// e" >> "$R/src/app/page.ts"
hx_has_receipt "$R" "$(hx_tree_key "$R")" "echo built"; chk "edit voids receipt" "$?" 1
git -C "$R" commit -qam "feat: e"

# failing build: no receipt, exit code passed through
setcmd "exit 7"; git -C "$R" commit -qam "chore: cmd"
( cd "$R" && bash "$H/harness-build" >"$T/out" 2>&1 ); chk "fail exit passthrough" "$?" 7
hx_has_receipt "$R" "$(hx_tree_key "$R")" "exit 7"; chk "no receipt on failure" "$?" 1

# tree changes during build: exit 3, no receipt
setcmd 'echo y >> src/app/page.ts'; git -C "$R" commit -qam "chore: cmd2"
( cd "$R" && bash "$H/harness-build" >"$T/out" 2>&1 ); chk "mutating build exit" "$?" 3
git -C "$R" checkout -q -- src/app/page.ts

# no config: exit 2
mkdir -p "$T/plain"; git init -q "$T/plain"
( cd "$T/plain" && bash "$H/harness-build" >"$T/out" 2>&1 ); chk "no config exit" "$?" 2

# invoked through a symlink (how it is installed)
mkdir -p "$T/bin"; ln -s "$H/harness-build" "$T/bin/harness-build"
setcmd "echo built"; git -C "$R" commit -qam "chore: cmd3"
( cd "$R" && "$T/bin/harness-build" >"$T/out" 2>&1 ); chk "symlink invocation" "$?" 0
hx_has_receipt "$R" "$(hx_tree_key "$R")" "echo built"; chk "symlink receipt" "$?" 0
done_ "REPO HARNESS BUILD"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-build.sh`
Expected: FAIL (`harness-build: No such file`), non-zero exit.

- [ ] **Step 3: Write harness-build**

Create `hooks/repo-harness/harness-build` (then `chmod +x hooks/repo-harness/harness-build`):

```bash
#!/bin/bash
# harness-build: run the repo's buildGate.cmd in the foreground; on exit 0 write a receipt for the exact tree built.
# Usage: run from inside a repo that has .claude/harness.json. Never run it with run_in_background.
# Exit: 0 passed + receipt; 2 no config/cmd; 3 tree changed during the build (no receipt); else the build's exit code.
# Writes: <git-common-dir>/harness/<tree key> only. Uses rg-run --class build when available (resource guard).
set -u
src="$0"
while [ -L "$src" ]; do
  t="$(readlink "$src")"
  case "$t" in /*) src="$t";; *) src="$(dirname "$src")/$t";; esac
done
HERE="$(cd "$(dirname "$src")" && pwd)"
. "$HERE/lib.sh"
cfg="$(hx_cfg_file "$PWD")" || { echo "harness-build: no .claude/harness.json in this repo" >&2; exit 2; }
cmd="$(jq -r '.buildGate.cmd // empty' "$cfg")"
[ -n "$cmd" ] || { echo "harness-build: buildGate.cmd missing in $cfg" >&2; exit 2; }
root="$(hx_root "$PWD")"; cd "$root" || exit 2
before="$(hx_tree_key "$root")"
if [ "$before" != "$(git rev-parse 'HEAD^{tree}' 2>/dev/null)" ]; then
  echo "harness-build: WARNING uncommitted/untracked changes. The receipt covers this working state; a later push checks the COMMITTED tree, so commit first, then build, for a push-valid receipt." >&2
fi
echo "harness-build: running: $cmd"
if command -v rg-run >/dev/null 2>&1 && [ "${HARNESS_NO_RG:-0}" != 1 ]; then
  rg-run --class build --label harness-build -- sh -c "$cmd"
else
  sh -c "$cmd"
fi
rc=$?
if [ "$rc" -ne 0 ]; then echo "harness-build: build failed (exit $rc), no receipt" >&2; exit "$rc"; fi
after="$(hx_tree_key "$root")"
if [ -z "$after" ] || [ "$before" != "$after" ]; then
  echo "harness-build: working tree changed during the build, no receipt. Re-run." >&2; exit 3
fi
hx_write_receipt "$root" "$after" "$cmd" || { echo "harness-build: could not write receipt" >&2; exit 4; }
echo "harness-build: receipt written for tree $after"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x hooks/repo-harness/harness-build && bash hooks/tests/test-repo-harness-build.sh`
Expected: `REPO HARNESS BUILD PASS`.

- [ ] **Step 5: Commit**

```bash
git add hooks/repo-harness/harness-build hooks/tests/test-repo-harness-build.sh
git commit -m "feat: add harness-build wrapper that writes tree-keyed build receipts" -- hooks/repo-harness/harness-build hooks/tests/test-repo-harness-build.sh
```

---

### Task 3: Stop gate

**Files:**
- Create: `hooks/repo-harness/stop-gate.sh`
- Test: `hooks/tests/test-repo-harness-stop.sh`

**Interfaces:**
- Consumes: `hx_off`, `hx_cfg_file`, `hx_root`, `hx_changed_files`, `hx_any_match`, `hx_tree_key`, `hx_has_receipt`, `harness-build` receipts.
- Produces: Stop hook. Input JSON fields used: `cwd`, `session_id`, `stop_hook_active`, `last_assistant_message`. Output on block: `{"decision":"block","reason":"..."}`, exit 0. State: `${HARNESS_HOME:-$HOME/.claude/harness}/stop/<tree key>` (once per key).

- [ ] **Step 1: Write the failing test**

Create `hooks/tests/test-repo-harness-stop.sh`:

```bash
#!/bin/bash
# Synthetic test for hooks/repo-harness/stop-gate.sh.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; H="${REPO_HARNESS_DIR:-$HERE/../repo-harness}"
. "$HERE/lib-harness-fixture.sh"
. "$H/lib.sh"
R="$T/r"; mk_repo "$R"; git -C "$R" checkout -q -b feat
n=0
route() { n=$((n+1)); echo "// edit $n" >> "$R/src/app/page.ts"; }
pl() { jq -nc --arg c "$1" --arg s "s$n" --arg m "${2:-All done.}" '{session_id:$s,cwd:$c,last_assistant_message:$m}'; }
dec() { printf '%s' "$1" | jq -r '.decision // empty' 2>/dev/null; }

# docs-only change: silent
echo more >> "$R/docs/a.md"
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "docs-only silent" "$out" ""
git -C "$R" checkout -q -- docs/a.md

# route change, no receipt: blocks and names harness-build
route
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "route change blocks" "$(dec "$out")" block
case "$out" in *harness-build*) ;; *) echo "FAIL reason lacks harness-build"; fail=1;; esac
# same tree again: once per key
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "once per tree key" "$out" ""
# new edit = new key = blocks again
route
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "new key blocks again" "$(dec "$out")" block

# receipt present: silent
route
( cd "$R" && bash "$H/harness-build" >/dev/null 2>&1 )
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "receipt silences" "$out" ""

# stop_hook_active: silent
route
out="$(jq -nc --arg c "$R" '{session_id:"sx",cwd:$c,last_assistant_message:"done",stop_hook_active:true}' | bash "$H/stop-gate.sh")"
chk "stop_hook_active silent" "$out" ""
# WAITING ON and trailing question: silent
out="$(pl "$R" $'Cannot build now.\nWAITING ON owner: sandbox-off Yes/No for the build' | bash "$H/stop-gate.sh")"; chk "WAITING ON silent" "$out" ""
route
out="$(pl "$R" "Want me to run the build now?" | bash "$H/stop-gate.sh")"; chk "trailing question silent" "$out" ""

# kill switch and no-config repo: silent
route
mkdir -p "$HARNESS_HOME"; : > "$HARNESS_HOME/off"
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "kill switch silent" "$out" ""
rm -f "$HARNESS_HOME/off"
mkdir -p "$T/plain"; git init -q "$T/plain"
out="$(pl "$T/plain" | bash "$H/stop-gate.sh")"; chk "no config silent" "$out" ""

# commit first does not dodge the gate (merge-base diff)
route
git -C "$R" commit -qam "feat: more"
out="$(pl "$R" | bash "$H/stop-gate.sh")"; chk "committed change still gated" "$(dec "$out")" block
done_ "REPO HARNESS STOP"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-stop.sh`
Expected: FAIL (`stop-gate.sh: No such file`).

- [ ] **Step 3: Write stop-gate.sh**

Create `hooks/repo-harness/stop-gate.sh`:

```bash
#!/bin/bash
# Stop hook: block (once per tree key) when files matching buildGate.paths changed vs merge-base/working tree
# and no passing build receipt matches the current tree. A one-shot forced retry, not a wall: the push guard is the hard gate.
# Silent when: kill switch, away mode, stop_hook_active, no config, no build-path change, receipt present,
#   message has WAITING ON or ends with a question, or this tree key already blocked once.
# State: ${HARNESS_HOME:-~/.claude/harness}/stop/<tree key> (timestamp). Fail-open: always exit 0.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"
[ -f "$HERE/../away-lib.sh" ] && . "$HERE/../away-lib.sh" 2>/dev/null
if command -v away_is_away >/dev/null 2>&1 && away_is_away; then exit 0; fi
payload="$(cat)"
hx_off && exit 0
[ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0
cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)"; [ -n "$cwd" ] || exit 0
msg="$(printf '%s' "$payload" | jq -r '.last_assistant_message // empty' 2>/dev/null)"
cfg="$(hx_cfg_file "$cwd")" || exit 0
root="$(hx_root "$cwd")"; [ -n "$root" ] || exit 0
cmd="$(jq -r '.buildGate.cmd // empty' "$cfg" 2>/dev/null)"; [ -n "$cmd" ] || exit 0
main="$(jq -r '.pushFlow.mainBranch // "main"' "$cfg" 2>/dev/null)"
globs=(); while IFS= read -r l; do [ -n "$l" ] && globs+=("$l"); done < <(jq -r '.buildGate.paths[]? // empty' "$cfg" 2>/dev/null)
[ "${#globs[@]}" -gt 0 ] || exit 0
hx_changed_files "$root" "$main" | hx_any_match "${globs[@]}" || exit 0
key="$(hx_tree_key "$root")" || exit 0
[ -n "$key" ] || exit 0
hx_has_receipt "$root" "$key" "$cmd" && exit 0
printf '%s' "$msg" | grep -q 'WAITING ON' && exit 0
last="$(printf '%s\n' "$msg" | sed -e 's/[[:space:]]*$//' | awk 'NF{l=$0} END{print l}')"
case "$last" in *\?) exit 0;; esac
state="${HARNESS_HOME:-$HOME/.claude/harness}/stop"
[ -e "$state/$key" ] && exit 0
mkdir -p "$state" 2>/dev/null && date -u +%Y-%m-%dT%H:%M:%SZ > "$state/$key"
reason="Build-path files changed (${globs[*]}) and there is no passing build receipt for this exact tree. Run harness-build (sandbox off; it runs: $cmd), read the route table, then finish. If the build cannot run now, say why and end with WAITING ON <who>: <exact ask>."
jq -nc --arg r "$reason" '{decision:"block",reason:$r}'
exit 0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash hooks/tests/test-repo-harness-stop.sh`
Expected: `REPO HARNESS STOP PASS`.

- [ ] **Step 5: Commit**

```bash
git add hooks/repo-harness/stop-gate.sh hooks/tests/test-repo-harness-stop.sh
git commit -m "feat: add repo-harness Stop gate (block once per tree key without build receipt)" -- hooks/repo-harness/stop-gate.sh hooks/tests/test-repo-harness-stop.sh
```

---

### Task 4: Push guard

**Files:**
- Create: `hooks/repo-harness/push-guard.sh`
- Test: `hooks/tests/test-repo-harness-push.sh`

**Interfaces:**
- Consumes: `lib.sh` helpers; receipts from `harness-build`.
- Produces: PreToolUse(Bash) guard. Input: `.cwd`, `.tool_input.command`. Exit 0 allow; exit 2 deny with `HARNESS push-guard: <reason>` on stderr.

- [ ] **Step 1: Write the failing test**

Create `hooks/tests/test-repo-harness-push.sh`:

```bash
#!/bin/bash
# Synthetic test for hooks/repo-harness/push-guard.sh (local bare remote, no network).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; H="${REPO_HARNESS_DIR:-$HERE/../repo-harness}"
. "$HERE/lib-harness-fixture.sh"
. "$H/lib.sh"
R="$T/r"; mk_repo "$R"
mkdir -p "$T/plain2"; git init -q "$T/plain2"
git init -q --bare "$T/remote.git"; git -C "$R" remote add origin "$T/remote.git"; git -C "$R" push -q origin main
run() { jq -nc --arg c "$R" --arg cmd "$1" '{cwd:$c,tool_name:"Bash",tool_input:{command:$cmd}}' | bash "$H/push-guard.sh" 2>"$T/err"; echo $?; }
CMD="echo built"

chk "non-push command" "$(run 'ls -la')" 0
chk "other git command" "$(run 'git status')" 0

# feature branch push is denied
git -C "$R" checkout -q -b feat
chk "feature push denied" "$(run 'git push origin feat')" 2
case "$(cat "$T/err")" in *"feature-branch"*) ;; *) echo "FAIL feature msg: $(cat "$T/err")"; fail=1;; esac
chk "bare git push on feature denied" "$(run 'git push')" 2

# main: force denied, deletion denied, --all denied
git -C "$R" checkout -q main
chk "force main denied" "$(run 'git push --force origin main')" 2
chk "+refspec main denied" "$(run 'git push origin +main')" 2
chk "delete denied" "$(run 'git push origin :main')" 2
chk "--all denied" "$(run 'git push --all')" 2

# docs-only unpushed commit: no receipt needed
echo more >> "$R/docs/a.md"; git -C "$R" commit -qam "docs: more"
chk "docs-only allowed without receipt" "$(run 'git push origin main')" 0

# route change unpushed: needs receipt for the pushed tree
echo "// r" >> "$R/src/app/page.ts"; git -C "$R" commit -qam "feat: route"
chk "route push needs receipt" "$(run 'git push origin main')" 2
case "$(cat "$T/err")" in *harness-build*) ;; *) echo "FAIL receipt msg: $(cat "$T/err")"; fail=1;; esac
chk "compound command still caught" "$(run 'cd /tmp && git push origin main')" 2
chk "git -C form caught" "$(run "git -C $R push origin main")" 2
chk "git -c form caught" "$(run 'git -c core.x=1 push origin main')" 2
chk "git -C other repo (no config) allowed" "$(run "git -C $T/plain2 push origin feat")" 0
hx_write_receipt "$R" "$(hx_tree_key "$R" HEAD)" "$CMD"
chk "receipt allows push" "$(run 'git push origin main')" 0
chk "receipt allows bare push on main" "$(run 'git push')" 0

# HEAD:main from a feature branch needs the receipt of HEAD
git -C "$R" push -q origin main
git -C "$R" checkout -q -b feat2
echo "// f2" >> "$R/src/app/page.ts"; git -C "$R" commit -qam "feat: f2"
chk "HEAD:main without receipt denied" "$(run 'git push origin HEAD:main')" 2
hx_write_receipt "$R" "$(hx_tree_key "$R" HEAD)" "$CMD"
chk "HEAD:main with receipt allowed" "$(run 'git push origin HEAD:main')" 0

# no config and kill switch: allow
mkdir -p "$T/plain"; git init -q "$T/plain"
chk "no config allow" "$(jq -nc --arg c "$T/plain" '{cwd:$c,tool_input:{command:"git push origin feat"}}' | bash "$H/push-guard.sh" 2>/dev/null; echo $?)" 0
mkdir -p "$HARNESS_HOME"; : > "$HARNESS_HOME/off"
chk "kill switch allow" "$(run 'git push origin feat')" 0
done_ "REPO HARNESS PUSH"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-push.sh`
Expected: FAIL (`push-guard.sh: No such file`).

- [ ] **Step 3: Write push-guard.sh**

Create `hooks/repo-harness/push-guard.sh`:

```bash
#!/bin/bash
# PreToolUse(Bash) guard for `git push` in repos that have .claude/harness.json.
# Denies (exit 2, reason on stderr): feature-branch push (pushFlow.blockFeaturePush), force/delete/--all/--mirror,
#   and a push to main whose commits touch buildGate.paths without a receipt for the PUSHED commit's tree.
# Resolves the pushed ref from the command (git push | git push <remote> <ref> | HEAD:main | +ref). Unresolvable = deny.
# Fail-open on internal errors (no jq/config); no env-var bypass; kill switch file only.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"
payload="$(cat)"
hx_off && exit 0
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
GP='git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)'
printf '%s' "$cmd" | grep -Eq "(^|[;&|[:space:]])$GP" || exit 0
cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)"; [ -n "$cwd" ] || exit 0
# git -C <path> push: judge the repo at <path> (relative to cwd), not cwd
cpath="$(printf '%s' "$cmd" | grep -oE "git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+)*[[:space:]]+push" | head -1 | sed -nE 's/.*-C[[:space:]]+([^[:space:]]+).*/\1/p')"
if [ -n "$cpath" ]; then case "$cpath" in /*) cwd="$cpath";; *) cwd="$cwd/$cpath";; esac; fi
cfg="$(hx_cfg_file "$cwd")" || exit 0
root="$(hx_root "$cwd")"; [ -n "$root" ] || exit 0
main="$(jq -r '.pushFlow.mainBranch // "main"' "$cfg" 2>/dev/null)"
blockfeat="$(jq -r '.pushFlow.blockFeaturePush // false' "$cfg" 2>/dev/null)"
deny() { printf 'HARNESS push-guard: %s\n' "$1" >&2; exit 2; }

rest="$(printf '%s' "$cmd" | sed -E 's/^.*git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+)*[[:space:]]+push//')"; rest="${rest%%[;&|]*}"
set -f; set -- $rest; set +f
force=0; args=()
for t in "$@"; do
  case "$t" in
    --all|--mirror) deny "unresolvable push form ($t). Push one named branch: git push origin $main." ;;
    --force|-f|--force-with-lease*|--force-if-includes) force=1 ;;
    +*) force=1; args+=("${t#+}") ;;
    -*) ;;
    *) args+=("$t") ;;
  esac
done
remote="${args[0]:-origin}"; spec="${args[1]:-}"
cur="$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -z "$spec" ]; then
  src="HEAD"; dst="$cur"
else
  case "$spec" in
    *:*) src="${spec%%:*}"; dst="${spec#*:}" ;;
    *) src="$spec"; dst="$spec" ;;
  esac
fi
dst="${dst#refs/heads/}"
[ -n "$src" ] || deny "branch deletion ($spec) is not allowed."
[ "$force" = 1 ] && [ "$dst" = "$main" ] && deny "force-push to $main is not allowed."
if [ "$blockfeat" = true ] && [ "$dst" != "$main" ]; then
  deny "feature-branch push ($dst) is not allowed. Merge into $main in the main checkout (--no-ff), then push $main."
fi
[ "$dst" = "$main" ] || exit 0

bcmd="$(jq -r '.buildGate.cmd // empty' "$cfg" 2>/dev/null)"; [ -n "$bcmd" ] || exit 0
globs=(); while IFS= read -r l; do [ -n "$l" ] && globs+=("$l"); done < <(jq -r '.buildGate.paths[]? // empty' "$cfg" 2>/dev/null)
[ "${#globs[@]}" -gt 0 ] || exit 0
git -C "$root" rev-parse -q --verify "$src^{commit}" >/dev/null 2>&1 || deny "cannot resolve $src."
if git -C "$root" rev-parse -q --verify "refs/remotes/$remote/$main" >/dev/null 2>&1; then
  files="$(git -C "$root" diff --name-only "$remote/$main...$src" 2>/dev/null)"
else
  files="$(git -C "$root" ls-tree -r --name-only "$src" 2>/dev/null)"
fi
printf '%s\n' "$files" | hx_any_match "${globs[@]}" || exit 0
key="$(hx_tree_key "$root" "$src")" || exit 0
[ -n "$key" ] || exit 0
hx_has_receipt "$root" "$key" "$bcmd" && exit 0
deny "the pushed tree ($key) touches build paths and has no passing build receipt. Commit everything first (a dirty tree never matches a commit), run harness-build in this checkout (sandbox off; it runs: $bcmd), then push again."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash hooks/tests/test-repo-harness-push.sh`
Expected: `REPO HARNESS PUSH PASS`.

- [ ] **Step 5: Commit**

```bash
git add hooks/repo-harness/push-guard.sh hooks/tests/test-repo-harness-push.sh
git commit -m "feat: add repo-harness push guard (feature-branch, force, build receipt of pushed tree)" -- hooks/repo-harness/push-guard.sh hooks/tests/test-repo-harness-push.sh
```

---

### Task 5: commit-scope, receipt-guard and the PreToolUse dispatcher

**Files:**
- Create: `hooks/repo-harness/commit-scope.sh`, `hooks/repo-harness/receipt-guard.sh`, `hooks/repo-harness/pre-tool.sh`
- Test: `hooks/tests/test-repo-harness-pre.sh`

**Interfaces:**
- Consumes: `lib.sh`; `push-guard.sh` (Task 4).
- Produces: `pre-tool.sh` registered once for PreToolUse (`Bash|Write|Edit`). It pipes the payload to `receipt-guard.sh`, `push-guard.sh`, `commit-scope.sh` in that order; first exit 2 wins (its stderr is re-emitted, exit 2).

- [ ] **Step 1: Write the failing test**

Create `hooks/tests/test-repo-harness-pre.sh`:

```bash
#!/bin/bash
# Synthetic test for commit-scope.sh, receipt-guard.sh and pre-tool.sh.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; H="${REPO_HARNESS_DIR:-$HERE/../repo-harness}"
. "$HERE/lib-harness-fixture.sh"
. "$H/lib.sh"
R="$T/r"; mk_repo "$R"
bash_pl() { jq -nc --arg c "$R" --arg cmd "$1" '{cwd:$c,tool_name:"Bash",tool_input:{command:$cmd}}'; }
file_pl() { jq -nc --arg c "$R" --arg t "$1" --arg p "$2" '{cwd:$c,tool_name:$t,tool_input:{file_path:$p}}'; }
rc() { "$@" >/dev/null 2>"$T/err"; echo $?; }

# commit-scope
cs() { bash_pl "$1" | bash "$H/commit-scope.sh" >/dev/null 2>"$T/err"; echo $?; }
chk "allowed scope" "$(cs 'git commit -m "fix(teachers): x"')" 0
chk "bang scope allowed" "$(cs 'git commit -m "feat(ppr)!: x"')" 0
chk "no scope allowed" "$(cs 'git commit -m "docs: x"')" 0
chk "merge exempt" "$(cs 'git commit -m "merge: docs"')" 0
chk "not a commit" "$(cs 'git status')" 0
chk "a11y scope denied" "$(cs 'git commit -m "fix(a11y): contrast"')" 2
chk "git -C commit scope denied" "$(cs "git -C $R commit -m \"fix(a11y): x\"")" 2
chk "git -c commit scope denied" "$(cs 'git -c user.name=x commit -m "fix(a11y): x"')" 2
case "$(cat "$T/err")" in *"Allowed: bridge, seo"*) ;; *) echo "FAIL scope msg: $(cat "$T/err")"; fail=1;; esac
chk "heredoc message scope denied" "$(cs "git commit -m \"\$(cat <<'EOF'
feat(zzz): thing
EOF
)\"")" 2

# receipt-guard
rg() { bash_pl "$1" | bash "$H/receipt-guard.sh" >/dev/null 2>"$T/err"; echo $?; }
chk "bash write to receipt dir denied" "$(rg "echo '{}' > $R/.git/harness/abc")" 2
chk "bash touch receipt denied" "$(rg "touch $R/.git/harness/abc")" 2
chk "bash ls receipt dir allowed" "$(rg "ls $R/.git/harness")" 0
chk "git commit mentioning path allowed" "$(rg 'git commit -m "docs: mention .git/harness"')" 0
chk "harness-build allowed" "$(rg 'harness-build')" 0
chk "Write receipt denied" "$(file_pl Write "$R/.git/harness/abc" | bash "$H/receipt-guard.sh" >/dev/null 2>&1; echo $?)" 2
chk "Edit worktree receipt denied" "$(file_pl Edit "$R/.git/worktrees/w/harness/abc" | bash "$H/receipt-guard.sh" >/dev/null 2>&1; echo $?)" 2
chk "Write normal file allowed" "$(file_pl Write "$R/src/app/page.ts" | bash "$H/receipt-guard.sh" >/dev/null 2>&1; echo $?)" 0

# dispatcher: first deny wins, benign passes, stderr forwarded
pt() { bash "$H/pre-tool.sh" 2>"$T/err"; echo $?; }
chk "dispatcher benign" "$(bash_pl 'ls' | pt)" 0
chk "dispatcher scope deny" "$(bash_pl 'git commit -m "fix(a11y): x"' | pt)" 2
case "$(cat "$T/err")" in *commit-scope*) ;; *) echo "FAIL dispatcher stderr: $(cat "$T/err")"; fail=1;; esac
chk "dispatcher receipt deny" "$(file_pl Write "$R/.git/harness/k" | pt)" 2
git -C "$R" checkout -q -b feat
chk "dispatcher push deny" "$(bash_pl 'git push origin feat' | pt)" 2

# no config / kill switch
mkdir -p "$T/plain"; git init -q "$T/plain"
chk "no config scope allow" "$(jq -nc --arg c "$T/plain" '{cwd:$c,tool_input:{command:"git commit -m \"fix(a11y): x\""}}' | bash "$H/commit-scope.sh" >/dev/null 2>&1; echo $?)" 0
mkdir -p "$HARNESS_HOME"; : > "$HARNESS_HOME/off"
chk "kill switch scope allow" "$(cs 'git commit -m "fix(a11y): x"')" 0
done_ "REPO HARNESS PRE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-pre.sh`
Expected: FAIL (missing scripts).

- [ ] **Step 3: Write commit-scope.sh**

Create `hooks/repo-harness/commit-scope.sh`:

```bash
#!/bin/bash
# PreToolUse(Bash): in repos with .claude/harness.json commitScopes, a conventional-commit scope, if present, must be listed.
# No scope = allowed. Merge commits ("merge: ...") have no scope = allowed. Complements the global commit-format.sh (type prefix).
# Finds the first `type(scope):` anywhere in the command text, so quoting/heredoc forms are covered.
# Exit 2 + stderr = deny. Fail-open on missing jq/config.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"
payload="$(cat)"
hx_off && exit 0
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
GC='git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)'
printf '%s' "$cmd" | grep -Eq "(^|[;&|[:space:]])$GC" || exit 0
cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)"; [ -n "$cwd" ] || exit 0
cpath="$(printf '%s' "$cmd" | grep -oE "git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+)*[[:space:]]+commit" | head -1 | sed -nE 's/.*-C[[:space:]]+([^[:space:]]+).*/\1/p')"
if [ -n "$cpath" ]; then case "$cpath" in /*) cwd="$cpath";; *) cwd="$cwd/$cpath";; esac; fi
cfg="$(hx_cfg_file "$cwd")" || exit 0
[ "$(jq '(.commitScopes // []) | length' "$cfg" 2>/dev/null)" -gt 0 ] 2>/dev/null || exit 0
hdr="$(printf '%s' "$cmd" | grep -oE '(feat|fix|refactor|chore|style|docs|test|perf)\([^)]*\)!?:' | head -1)"
[ -n "$hdr" ] || exit 0
scope="${hdr#*(}"; scope="${scope%%)*}"
jq -e --arg s "$scope" '.commitScopes | index($s)' "$cfg" >/dev/null 2>&1 && exit 0
list="$(jq -r '.commitScopes | join(", ")' "$cfg")"
printf 'HARNESS commit-scope: scope "%s" is not allowed in this repo. Allowed: %s. Omit the scope or use one of these (a11y fixes use the component scope).\n' "$scope" "$list" >&2
exit 2
```

- [ ] **Step 4: Write receipt-guard.sh**

Create `hooks/repo-harness/receipt-guard.sh`:

```bash
#!/bin/bash
# PreToolUse(Bash|Write|Edit): deny hand-writing build receipts under <git-common-dir>/harness/.
# Only harness-build may create them. Reads of that dir (ls/cat/jq/grep/head/tail/stat/find) and git/gh commands that merely
# mention the path (commit messages) are allowed. Guards against accidents, not an adversary. Exit 2 + stderr = deny.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"
payload="$(cat)"
hx_off && exit 0
tool="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null)"
msg='HARNESS receipt-guard: build receipts are written only by harness-build. Run it instead of writing under .git/harness.'
case "$tool" in
  Write|Edit)
    p="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
    printf '%s' "$p" | grep -Eq '(^|/)\.git/(worktrees/[^/]+/)?harness(/|$)' && { printf '%s\n' "$msg" >&2; exit 2; }
    ;;
  Bash)
    cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
    printf '%s' "$cmd" | grep -Eq '\.git/(worktrees/[^/]+/)?harness' || exit 0
    printf '%s' "$cmd" | grep -Eq '^[[:space:]]*(git|gh|ls|cat|jq|grep|head|tail|stat|find)[[:space:]]' && exit 0
    printf '%s\n' "$msg" >&2; exit 2
    ;;
esac
exit 0
```

- [ ] **Step 5: Write pre-tool.sh**

Create `hooks/repo-harness/pre-tool.sh`:

```bash
#!/bin/bash
# PreToolUse dispatcher (registered once for Bash|Write|Edit): runs receipt-guard, push-guard, commit-scope in order.
# The first guard that exits 2 wins; its stderr is re-emitted. Running them in one process avoids parallel-hook ordering.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
payload="$(cat)"
for s in receipt-guard push-guard commit-scope; do
  err="$(printf '%s' "$payload" | bash "$HERE/$s.sh" 2>&1 >/dev/null)"; rc=$?
  if [ "$rc" -eq 2 ]; then printf '%s\n' "$err" >&2; exit 2; fi
done
exit 0
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bash hooks/tests/test-repo-harness-pre.sh`
Expected: `REPO HARNESS PRE PASS`. The dispatcher stderr check expects the text `commit-scope` (the script prints `HARNESS commit-scope:`).

- [ ] **Step 7: Commit**

```bash
git add hooks/repo-harness/commit-scope.sh hooks/repo-harness/receipt-guard.sh hooks/repo-harness/pre-tool.sh hooks/tests/test-repo-harness-pre.sh
git commit -m "feat: add repo-harness commit-scope, receipt-guard and PreToolUse dispatcher" -- hooks/repo-harness/commit-scope.sh hooks/repo-harness/receipt-guard.sh hooks/repo-harness/pre-tool.sh hooks/tests/test-repo-harness-pre.sh
```

---

### Task 6: UI rules warning hook

**Files:**
- Create: `hooks/repo-harness/ui-rules.sh`
- Test: `hooks/tests/test-repo-harness-ui.sh`

**Interfaces:**
- Consumes: `lib.sh`. Config: `uiRules[]` of `{glob, when, mustHave}` (`when` is an ERE tested against the file, `mustHave` a fixed string).
- Produces: PostToolUse(Edit|Write) hook; exit 2 with stderr `HARNESS ui-rules (warning, edit already applied): ...` (tool already ran; this is a warning to Claude, not a block).

- [ ] **Step 1: Write the failing test**

Create `hooks/tests/test-repo-harness-ui.sh`:

```bash
#!/bin/bash
# Synthetic test for hooks/repo-harness/ui-rules.sh.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; H="${REPO_HARNESS_DIR:-$HERE/../repo-harness}"
. "$HERE/lib-harness-fixture.sh"
R="$T/r"; mk_repo "$R"
pl() { jq -nc --arg c "$R" --arg p "$1" '{cwd:$c,tool_name:"Edit",tool_input:{file_path:$p}}'; }
run() { pl "$1" | bash "$H/ui-rules.sh" >/dev/null 2>"$T/err"; echo $?; }

printf 'export const A = () => <button onClick={f}>x</button>\n' > "$R/src/components/A.tsx"
chk "missing cursor-pointer warns" "$(run "$R/src/components/A.tsx")" 2
case "$(cat "$T/err")" in *cursor-pointer*) ;; *) echo "FAIL warn msg: $(cat "$T/err")"; fail=1;; esac
printf 'export const B = () => <button className="cursor-pointer" onClick={f}>x</button>\n' > "$R/src/components/B.tsx"
chk "has cursor-pointer ok" "$(run "$R/src/components/B.tsx")" 0
printf 'export const C = () => <p>text</p>\n' > "$R/src/components/C.tsx"
chk "no trigger ok" "$(run "$R/src/components/C.tsx")" 0
printf 'onClick here\n' > "$R/docs/x.md"
chk "outside glob ok" "$(run "$R/docs/x.md")" 0
printf '<button onClick>\n' > "$T/elsewhere.tsx"
chk "outside repo ok" "$(run "$T/elsewhere.tsx")" 0
chk "missing file ok" "$(run "$R/src/components/nope.tsx")" 0
jq '.uiRules=[]' "$R/.claude/harness.json" > "$T/h.json" && cp "$T/h.json" "$R/.claude/harness.json"
chk "no rules ok" "$(run "$R/src/components/A.tsx")" 0
mkdir -p "$T/plain"; git init -q "$T/plain"
chk "no config ok" "$(jq -nc --arg c "$T/plain" --arg p "$R/src/components/A.tsx" '{cwd:$c,tool_input:{file_path:$p}}' | bash "$H/ui-rules.sh" >/dev/null 2>&1; echo $?)" 0
done_ "REPO HARNESS UI"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-ui.sh`
Expected: FAIL (`ui-rules.sh: No such file`).

- [ ] **Step 3: Write ui-rules.sh**

Create `hooks/repo-harness/ui-rules.sh`:

```bash
#!/bin/bash
# PostToolUse(Edit|Write): for each uiRules entry {glob, when, mustHave}: if the edited file matches glob, contains the
# ERE `when`, and lacks the fixed string `mustHave`, warn. File-level heuristic (not per element): warns only.
# Exit 2 + stderr (the tool already ran). Silent when outside the repo, no rules, or no config.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib.sh"
payload="$(cat)"
hx_off && exit 0
f="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -n "$f" ] && [ -f "$f" ] || exit 0
f="$(cd "$(dirname "$f")" && pwd -P)/$(basename "$f")"   # canonical: git root is a physical path, tmp/worktree paths may be symlinked
cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)"; [ -n "$cwd" ] || exit 0
cfg="$(hx_cfg_file "$cwd")" || exit 0
root="$(hx_root "$cwd")"; [ -n "$root" ] || exit 0
case "$f" in "$root"/*) ;; *) exit 0;; esac
rel="${f#"$root"/}"
n="$(jq '(.uiRules // []) | length' "$cfg" 2>/dev/null)" || exit 0
[ "$n" -gt 0 ] 2>/dev/null || exit 0
msgs=""; i=0
while [ "$i" -lt "$n" ]; do
  glob="$(jq -r ".uiRules[$i].glob" "$cfg")"; when="$(jq -r ".uiRules[$i].when" "$cfg")"; must="$(jq -r ".uiRules[$i].mustHave" "$cfg")"
  re="^$(hx_glob_to_re "$glob")\$"
  if printf '%s\n' "$rel" | grep -Eq "$re" && grep -Eq -- "$when" "$f" && ! grep -Fq -- "$must" "$f"; then
    msgs="${msgs}${rel} matches '${when}' but has no '${must}' (AGENTS.md UI rule). "
  fi
  i=$((i+1))
done
[ -z "$msgs" ] && exit 0
printf 'HARNESS ui-rules (warning, edit already applied): %s\n' "$msgs" >&2
exit 2
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash hooks/tests/test-repo-harness-ui.sh`
Expected: `REPO HARNESS UI PASS`.

- [ ] **Step 5: Commit**

```bash
git add hooks/repo-harness/ui-rules.sh hooks/tests/test-repo-harness-ui.sh
git commit -m "feat: add repo-harness UI rules warning hook" -- hooks/repo-harness/ui-rules.sh hooks/tests/test-repo-harness-ui.sh
```

---

### Task 7: Installer, reach-radio-nextjs config, live check (OWNER-GATED steps marked)

**Files:**
- Create (CCC worktree): `hooks/apply-repo-harness.sh`, `hooks/tests/test-repo-harness-apply.sh`
- Modify (CCC worktree): `settings.json` (mirror, done by the apply script with `MIRROR_SETTINGS`)
- Create (reach-radio-nextjs worktree `/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/murex`): `.claude/harness.json`
- Modify (same worktree): `.gitignore`

**Interfaces:**
- Consumes: all hooks from Tasks 1-6; `hooks/lib-apply-guarded.sh` (`put_guarded <src> <dst>`, needs `TS` and array `BAKS`).
- Produces: `apply-repo-harness.sh`: installs `lib.sh`, `harness-build`, `stop-gate.sh`, `push-guard.sh`, `commit-scope.sh`, `receipt-guard.sh`, `pre-tool.sh`, `ui-rules.sh` to `$CLAUDE_HOME/hooks/repo-harness/`; symlinks `${HARNESS_BIN_DIR:-$HOME/.local/bin}/harness-build`; registers Stop (`stop-gate.sh`), PreToolUse matcher `Bash|Write|Edit` (`pre-tool.sh`), PostToolUse matcher `Edit|Write` (`ui-rules.sh`) in `$CLAUDE_HOME/settings.json` and `${MIRROR_SETTINGS:-<repo>/settings.json}`; backups first, `jq -e .` verify, idempotent.

- [ ] **Step 1: Write the failing test**

Create `hooks/tests/test-repo-harness-apply.sh`:

```bash
#!/bin/bash
# Synthetic test for hooks/apply-repo-harness.sh (temp CLAUDE_HOME, temp bin dir, temp mirror; never the real ones).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; A="${APPLY_SCRIPT:-$HERE/../apply-repo-harness.sh}"
T="$(cd "$(mktemp -d "${TMPDIR:-/tmp}/hxa.XXXXXX")" && pwd -P)"; trap 'rm -rf "$T"' EXIT
fail=0; chk() { [ "$2" = "$3" ] || { echo "FAIL $1: got '$2' want '$3'"; fail=1; }; }
export TMPDIR="$T"   # backups land here
mkdir -p "$T/ch/hooks" "$T/bin"
echo '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"/x/existing.sh"}]}]}}' | jq . > "$T/ch/settings.json"
cp "$T/ch/settings.json" "$T/mirror.json"
export CLAUDE_HOME="$T/ch" HARNESS_BIN_DIR="$T/bin" MIRROR_SETTINGS="$T/mirror.json"

bash "$A" >"$T/out1" 2>&1; chk "first apply exit" "$?" 0
for f in lib.sh harness-build stop-gate.sh push-guard.sh commit-scope.sh receipt-guard.sh pre-tool.sh ui-rules.sh; do
  [ -f "$T/ch/hooks/repo-harness/$f" ] || { echo "FAIL not installed: $f"; fail=1; }
done
[ -x "$T/ch/hooks/repo-harness/harness-build" ] || { echo "FAIL harness-build not executable"; fail=1; }
[ -L "$T/bin/harness-build" ] || { echo "FAIL no symlink"; fail=1; }
chk "symlink target" "$(readlink "$T/bin/harness-build")" "$T/ch/hooks/repo-harness/harness-build"
S="$T/ch/settings.json"
chk "existing Stop kept" "$(jq '[.hooks.Stop[].hooks[].command] | index("/x/existing.sh")' "$S")" 0
chk "stop-gate registered" "$(jq '[.hooks.Stop[].hooks[].command] | map(select(endswith("repo-harness/stop-gate.sh"))) | length' "$S")" 1
chk "pre-tool matcher" "$(jq -r '.hooks.PreToolUse[] | select(.hooks[0].command | endswith("repo-harness/pre-tool.sh")) | .matcher' "$S")" "Bash|Write|Edit"
chk "ui-rules matcher" "$(jq -r '.hooks.PostToolUse[] | select(.hooks[0].command | endswith("repo-harness/ui-rules.sh")) | .matcher' "$S")" "Edit|Write"
chk "mirror patched too" "$(jq '[.hooks.PreToolUse[].hooks[].command] | map(select(endswith("repo-harness/pre-tool.sh"))) | length' "$T/mirror.json")" 1
ls "$T"/ch-settings.json.bak.* >/dev/null 2>&1 || { echo "FAIL no settings backup in TMPDIR"; fail=1; }
ls "$T/ch"/settings.json.bak.* >/dev/null 2>&1 && { echo "FAIL backup written next to settings"; fail=1; }

bash "$A" >"$T/out2" 2>&1; chk "second apply exit" "$?" 0
chk "idempotent Stop count" "$(jq '[.hooks.Stop[].hooks[].command] | map(select(endswith("repo-harness/stop-gate.sh"))) | length' "$S")" 1
chk "idempotent PreToolUse count" "$(jq '[.hooks.PreToolUse[].hooks[].command] | map(select(endswith("repo-harness/pre-tool.sh"))) | length' "$S")" 1
# reformatting abort: a settings file whose formatting jq would rewrite must be left untouched
printf '{"hooks":{"Stop":[ {"hooks":[{"type":"command","command":"/x/y.sh"}]} ]},\n"permissions":{"allow":["a","b"]}}' > "$T/ch/settings.json"
cp "$T/ch/settings.json" "$T/ugly.json"; MIRROR_SETTINGS="$T/none.json" bash "$A" >"$T/out3" 2>&1; chk "ugly format aborts" "$?" 1
cmp -s "$T/ch/settings.json" "$T/ugly.json" || { echo "FAIL ugly settings modified"; fail=1; }
[ "$fail" = 0 ] && echo "REPO HARNESS APPLY PASS" || { echo "REPO HARNESS APPLY FAIL"; exit 1; }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash hooks/tests/test-repo-harness-apply.sh`
Expected: FAIL (`apply-repo-harness.sh: No such file`).

- [ ] **Step 3: Write the apply script**

Create `hooks/apply-repo-harness.sh`:

```bash
#!/bin/bash
# Owner-run: install the repo-harness hooks and register them.
# Targets: $CLAUDE_HOME/hooks/repo-harness/* (guarded put, .bak.<ts>, .applied stamps), symlink
#   ${HARNESS_BIN_DIR:-~/.local/bin}/harness-build -> installed wrapper, and settings.json at $CLAUDE_HOME/settings.json
#   plus the repo mirror ${MIRROR_SETTINGS:-<repo>/settings.json}. Adds Stop(stop-gate), PreToolUse Bash|Write|Edit(pre-tool),
#   PostToolUse Edit|Write(ui-rules) if absent; settings backups go to $TMPDIR; added lines only (aborts otherwise);
#   verified with jq -e .; idempotent; no deletes.
# Read the diff of this script before running. Restart open sessions afterward so hooks load.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; CH="${CLAUDE_HOME:-$HOME/.claude}"; TS="$(date +%Y%m%d-%H%M%S)"; BAKS=()
BIN="${HARNESS_BIN_DIR:-$HOME/.local/bin}"; MIRROR="${MIRROR_SETTINGS:-$HERE/../settings.json}"
# shellcheck source=lib-apply-guarded.sh
. "$HERE/lib-apply-guarded.sh"
DST="$CH/hooks/repo-harness"; mkdir -p "$DST" "$BIN"
for f in lib.sh harness-build stop-gate.sh push-guard.sh commit-scope.sh receipt-guard.sh pre-tool.sh ui-rules.sh; do
  put_guarded "$HERE/repo-harness/$f" "$DST/$f"
  chmod +x "$DST/$f"
done
ln -sfn "$DST/harness-build" "$BIN/harness-build"; echo "linked $BIN/harness-build"

reg() { # reg <settings file> <event> <matcher or ""> <command> <timeout>
  local s="$1" ev="$2" m="$3" c="$4" t="$5"
  [ -f "$s" ] || { echo "skip $s (missing)"; return 0; }
  if jq -e --arg ev "$ev" --arg c "$c" '[.hooks[$ev][]?.hooks[]?.command] | index($c)' "$s" >/dev/null 2>&1; then
    echo "unchanged $s ($ev already registered)"; return 0
  fi
  local bak new; bak="${TMPDIR:-/tmp}/$(basename "$(dirname "$s")")-$(basename "$s").bak.$TS.$ev"; new="$bak.new"
  cp -p "$s" "$bak"
  jq --arg ev "$ev" --arg m "$m" --arg c "$c" --argjson t "$t" \
    '.hooks[$ev] = ((.hooks[$ev] // []) + [({hooks:[{type:"command",command:$c,timeout:$t}]} + (if $m == "" then {} else {matcher:$m} end))])' \
    "$bak" > "$new"
  jq -e . "$new" >/dev/null
  # edit only the named lines: the new file may differ from the backup by added lines only
  # (a removed line is fine only if it reappears with a trailing comma added, the array-append case)
  local rem add
  rem="$(diff -u "$bak" "$new" | grep -E '^-[^-]' | sed -e 's/^-//' -e 's/,$//' | sort || true)"
  add="$(diff -u "$bak" "$new" | grep -E '^\+[^+]' | sed -e 's/^+//' -e 's/,$//' | sort || true)"
  if [ -n "$(comm -23 <(printf '%s\n' "$rem" | sed '/^$/d') <(printf '%s\n' "$add") )" ]; then
    echo "ABORT $s: jq rewrite would change/remove existing lines (see: diff -u $bak $new). Nothing written." >&2; return 1
  fi
  cp "$new" "$s"; echo "patched $s ($ev, backup $bak). Added lines:"; diff -u "$bak" "$s" | grep -E '^\+[^+]' || true
}
for S in "$CH/settings.json" "$MIRROR"; do
  reg "$S" Stop "" "$DST/stop-gate.sh" 15
  reg "$S" PreToolUse "Bash|Write|Edit" "$DST/pre-tool.sh" 15
  reg "$S" PostToolUse "Edit|Write" "$DST/ui-rules.sh" 10
done
echo "Restart open sessions so the hooks load."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x hooks/apply-repo-harness.sh && bash hooks/tests/test-repo-harness-apply.sh`
Expected: `REPO HARNESS APPLY PASS`.

- [ ] **Step 5: Run the whole harness test set**

Run: `for t in lib build stop push pre ui apply; do bash hooks/tests/test-repo-harness-$t.sh || echo "BROKEN $t"; done; bash hooks/tests/test-config-health.sh`
Expected: seven `... PASS` lines, no `BROKEN`, and `test-config-health.sh` still passes (size budget untouched; this plan edits no always-loaded file).

- [ ] **Step 6: Commit the installer and tests (CCC worktree)**

```bash
git add hooks/apply-repo-harness.sh hooks/tests/test-repo-harness-apply.sh
git commit -m "feat: add apply script for repo-harness hooks and settings registration" -- hooks/apply-repo-harness.sh hooks/tests/test-repo-harness-apply.sh
```

- [ ] **Step 7: reach-radio-nextjs config (in `/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/murex`)**

First un-ignore the file. The repo's `.gitignore` has `.claude/*` with `!.claude/agents/`, `!.claude/skills/` exceptions (lines 47-51); without an exception `.claude/harness.json` is silently ignored. Edit `.gitignore`: after the line `!.claude/skills/**` add the line `!.claude/harness.json`.

Create `.claude/harness.json`:

```json
{
  "buildGate": {
    "cmd": "doppler run --project reach-radio-nextjs --config dev -- npx next build",
    "paths": ["src/**", "next.config.*", "package.json", "package-lock.json", "tsconfig.json"],
    "ignore": []
  },
  "pushFlow": { "mainBranch": "main", "blockFeaturePush": true },
  "commitScopes": ["bridge", "seo", "teachers", "schedule", "theme", "modal", "player", "sleep-timer", "donate", "about", "layout", "api", "global", "ppr", "test"],
  "uiRules": [
    { "glob": "src/components/**", "when": "<button|onClick|role=\"button\"", "mustHave": "cursor-pointer" },
    { "glob": "src/components/**", "when": "animate-", "mustHave": "motion-safe:" }
  ]
}
```

Verify the JSON and that git sees it: `jq -e . .claude/harness.json && git status --short .claude .gitignore` (expect `.claude/harness.json` untracked, `.gitignore` modified; if `harness.json` is not listed, the ignore exception is wrong).

`paths` is `src/**` (not just `src/app/**`) because `next build` fails on a TypeScript or "use client" error anywhere in the import graph. This widens the spec's example schema; the spec is synced in the same commit as this plan. Expected side effect: a stray `package-lock.json` change trips the gate. That is correct.

Commit (this repo's scopes; docs/config only):

```bash
git add .gitignore .claude/harness.json
git commit -m "chore: add harness.json build gate, push flow and scope rules" -- .gitignore .claude/harness.json
```

- [ ] **Step 8: OWNER-GATED, install**

Child sessions cannot ask the owner directly: end the turn with `WAITING ON owner: <ask>` and let the orchestrator roll it up. The ask is a Yes/No naming: command `bash hooks/apply-repo-harness.sh` (from the claude-code-config worktree, sandbox off); effect: copies 8 files to `~/.claude/hooks/repo-harness/` (guarded, `.bak` kept), symlinks `~/.local/bin/harness-build`, appends exactly these three entries (print them verbatim from the script's `reg` calls, with timeouts) to `~/.claude/settings.json` and the repo `settings.json` mirror:
- Stop: `.../repo-harness/stop-gate.sh` (timeout 15)
- PreToolUse, matcher `Bash|Write|Edit`: `.../repo-harness/pre-tool.sh` (timeout 15)
- PostToolUse, matcher `Edit|Write`: `.../repo-harness/ui-rules.sh` (timeout 10)
Settings backups go to `$TMPDIR`, only added lines are allowed (script aborts otherwise), `jq -e .` verified, idempotent, nothing deleted. Before asking, show the owner `git diff main -- hooks/apply-repo-harness.sh` and wait for it to be read. On Yes run it sandbox-off. On No give the `! bash <path>` line. Open sessions must restart before the hooks load.

- [ ] **Step 9: Smoke test the INSTALLED hooks with synthetic payloads (never a live push or commit)**

The child session started before install, so the hooks are not active in it. Do NOT run a real `git push` or a real junk commit. Pipe payloads into the installed scripts (sandbox off if reading `~/.claude`; set `W=/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/murex`, a git worktree on a feature branch):

```bash
H=~/.claude/hooks/repo-harness
W=/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/murex
# push guard through the dispatcher: feature-branch push must deny
jq -nc --arg c "$W" '{cwd:$c,tool_name:"Bash",tool_input:{command:"git push origin HEAD"}}' | "$H/pre-tool.sh"; echo "push rc=$? (want 2)"
# commit scope: a11y scope must deny
jq -nc --arg c "$W" '{cwd:$c,tool_name:"Bash",tool_input:{command:"git commit -m \"fix(a11y): smoke\""}}' | "$H/pre-tool.sh"; echo "scope rc=$? (want 2)"
# benign command passes
jq -nc --arg c "$W" '{cwd:$c,tool_name:"Bash",tool_input:{command:"ls"}}' | "$H/pre-tool.sh"; echo "benign rc=$? (want 0)"
# receipt hand-write denied
jq -nc --arg c "$W" --arg p "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir)/harness/x" '{cwd:$c,tool_name:"Write",tool_input:{file_path:$p}}' | "$H/pre-tool.sh"; echo "receipt rc=$? (want 2)"
# stop gate: with no receipt and src/** changed vs main it blocks once; state goes to a temp HARNESS_HOME
jq -nc --arg c "$W" '{session_id:"smoke",cwd:$c,last_assistant_message:"All done."}' | HARNESS_HOME="$(mktemp -d)" "$H/stop-gate.sh"
```

Expected: the three denies print `HARNESS ...` reasons, benign is 0, and the Stop payload prints a `{"decision":"block",...}` line only if this branch changes `src/**` (it may legitimately be silent on a docs-only branch; say which). Record every result in the final report.

- [ ] **Step 10: OWNER-GATED, real build receipt**

`WAITING ON owner:` Yes/No for the sandbox-off `harness-build` in the reach-radio-nextjs worktree (runs `doppler ... next build` through rg-run). On Yes: run `harness-build`; expect `harness-build: receipt written for tree <sha>` (a dirty tree prints the commit-first warning; that is fine here); run `ls "$(git rev-parse --git-common-dir)/harness"` and expect a file named by that sha. A stalled or surprising result means stop and report; never weaken a hook to make it pass.

- [ ] **Step 11: Final report**

Report: commits in the CCC worktree (hashes), commit in reach-radio-nextjs, all seven test PASS lines, step 9 results, step 10 result, then `DONE <CCC worktree branch>`. Nothing is pushed. The in-session check (restart, edit a `src/**` file and end a turn: Stop gate blocks once; try `git push` on a feature branch: denied) is the owner's after restart, listed under "Your move". Pushing claude-code-config and reach-radio-nextjs is a separate owner-gated Yes/No.

Execution note for the dispatcher: claude-code-config is outside the sandbox write allow-list, so every edit and commit there needs the sandbox off. The dispatching session asks ONE up-front Yes/No covering sandbox-off edits and commits in that worktree only; the child does not ask per commit.

- [ ] **Step 10: Final report**

Report to the orchestrator: commits in the CCC worktree (hashes), commit in reach-radio-nextjs, all seven test PASS lines, live smoke results, and `DONE <path to CCC worktree branch>`. Nothing is pushed; the push of claude-code-config and reach-radio-nextjs is a separate owner-gated Yes/No.

---

## Self-review (spec coverage)

- Global engine plus repo JSON: Tasks 1-7. No-config no-op: tested in Tasks 3, 4, 5, 6.
- Tree key (temp index, `write-tree`, commit keeps key): Task 1. Ignore pathspecs: Task 1.
- `harness-build` only receipt path, foreground, common-dir storage, symlink: Tasks 1, 2, 7.
- Stop gate (merge-base diff, once per key, `stop_hook_active`, WAITING ON/question skip, honest strength): Task 3.
- Push guard (feature-branch deny, force/delete/--all deny, pushed-tree receipt, parsing forms, fail closed): Task 4.
- Commit scopes (optional, list-checked, merges exempt, a11y/security off list): Task 5 + Task 7 config.
- Receipt hand-write deny, kill switch: Task 5 (guard), Tasks 1/3/4/5/6 (switch).
- UI rules warn-only: Task 6.
- Performance budget (spec): tree key measured 0.27 s in planning; no automated timing test (accepted).
- Spec deviation: spec "plan step 0: capture real payloads into fixtures" is replaced by reusing payload shapes already proven by `next-me-check` / `commit-format` tests, plus Task 7 step 9 synthetic-payload smoke of the installed hooks. Spec synced in the same commit as this plan.
- Review fixes folded in: smoke test never pushes or commits; fixture and ui-rules use physical paths (macOS tmp symlink); settings backup to `$TMPDIR` with added-lines-only guard; `git -C`/`-c` forms parsed; `paths` widened to `src/**`; dirty-tree hint in harness-build and push-guard.
- `.gitignore` exception for `.claude/harness.json`: Task 7 step 7 (found during planning).
