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

if [ -x "$REAL/node_modules/.bin/commitlint" ]; then
  cl() { printf '%s\n' "$1" | (cd "$REAL" && ./node_modules/.bin/commitlint >/dev/null 2>&1); echo $?; }
  chk 0 "$(cl 'fix(teachers): x')" "commitlint accepts a canonical scope"
  chk 0 "$(cl 'docs: x')" "commitlint accepts no scope"
  chk 1 "$(cl 'fix(Teachers): x')" "commitlint rejects a PascalCase scope"
  chk 1 "$(cl 'feat(nonsense): x')" "commitlint rejects an undocumented scope"
else
  echo "FAIL commitlint is not installed in the repo (run npm install)"; fail=1
fi

pre="$(node -e 'console.log(require(process.argv[1]).scripts.prepare)' "$REAL/package.json")"
case "$pre" in *"|| true") r=ok;; *) r="$pre";; esac; chk ok "$r" "prepare never fails an install (|| true)"
chk 100755 "$(cd "$REAL" && git ls-files -s .githooks/pre-push | cut -d' ' -f1)" "pre-push is executable in git"

[ "$fail" = 0 ] && echo "ALL PASS" || { echo "FAILURES"; exit 1; }
