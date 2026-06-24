# Skill Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 user-created Claude Code skills and update 7 stale pinned plugins.

**Architecture:** Skills live at `~/.claude/skills/<name>/SKILL.md`. All edits are targeted string replacements. `~/.claude` is not a git repo — no commits for skill files. Plugin updates are CLI commands. All 6 tasks are fully independent (different files) and can run in parallel.

**Tech Stack:** Markdown (skill files), Claude Code plugin CLI.

## Global Constraints

- Skill files: `~/.claude/skills/<name>/SKILL.md`
- Frontmatter format (goes at very top of file, before `# Title`):
  ```
  ---
  name: <kebab-case-slug>
  description: <one-liner used for triggering — be specific about when to invoke>
  ---
  ```
- Announce convention (goes immediately after the opening description paragraph):
  `**Announce at start:** "I'm using the <skill-name> skill to <purpose>."`
- Co-Authored-By correct value: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- AskUserQuestion: a tool call — skills must describe tool call pattern, not prose question
- Do NOT change any skill logic beyond what each task specifies

---

## Parallelization Analysis

> All 6 tasks touch different files. Run all in parallel — Wave 1.

### Wave 1 (no dependencies — fully parallel)
- Task 1: Update Stale Plugins
- Task 2: Fix continue-session
- Task 3: Fix copy-command
- Task 4: Fix full-review
- Task 5: Fix split-diff-into-commits
- Task 6: Fix decompose-plan-tasks

---

### Task 1: Update Stale Plugins

**Files:** None modified — CLI commands only.

**Context:** 7 plugins have `lastUpdated` equal to `installedAt`, meaning auto-update never ran for them. Pinned-version plugins don't auto-update. The plugins to update:
- `code-simplifier@claude-plugins-official` (v1.0.0, ~4 months stale)
- `typescript-lsp@claude-plugins-official` (v1.0.0, ~4 months stale)
- `claude-md-management@claude-plugins-official` (v1.0.0, ~4 months stale)
- `claude-code-setup@claude-plugins-official` (v1.0.0, ~4 months stale)
- `pyright-lsp@claude-plugins-official` (v1.0.0, ~3 months stale)
- `caveman@caveman` (commit hash, ~2 months stale)
- `warp@claude-code-warp` (v2.0.0, ~6 weeks stale)

- [ ] **Step 1: Snapshot current state for comparison**

```bash
cat ~/.claude/plugins/installed_plugins.json | python3 -c "
import json,sys
data=json.load(sys.stdin)
for name,entries in data['plugins'].items():
    for e in entries:
        print(f'{name}: v={e[\"version\"]} updated={e[\"lastUpdated\"][:10]}')
" | sort
```

Save the output mentally — compare after updates to confirm changes.

- [ ] **Step 2: Update all stale plugins**

In Claude Code's command palette or session, run each:
```
/plugins update code-simplifier
/plugins update typescript-lsp
/plugins update claude-md-management
/plugins update claude-code-setup
/plugins update pyright-lsp
/plugins update caveman
/plugins update warp
```

If `/plugins update <name>` fails, try the full plugin identifier:
```
/plugins update code-simplifier@claude-plugins-official
/plugins update caveman@caveman
/plugins update warp@claude-code-warp
```

- [ ] **Step 3: Verify updates**

```bash
cat ~/.claude/plugins/installed_plugins.json | python3 -c "
import json,sys
data=json.load(sys.stdin)
stale = ['code-simplifier','typescript-lsp','claude-md-management','claude-code-setup','pyright-lsp','caveman','warp']
for name,entries in data['plugins'].items():
    short = name.split('@')[0]
    if short in stale:
        for e in entries:
            print(f'{name}: v={e[\"version\"]} updated={e[\"lastUpdated\"][:10]}')
"
```

Expected: `lastUpdated` for each entry shows today's date (2026-06-17) or a newer version number.

If a plugin update is unavailable (no newer version exists), that's acceptable — the `lastUpdated` field will still be bumped to confirm the check ran.

---

### Task 2: Fix continue-session — Add Frontmatter + Announce

**Files:**
- Modify: `~/.claude/skills/continue-session/SKILL.md`

**What to fix:** Missing frontmatter block and missing `Announce at start` line. No logic changes.

- [ ] **Step 1: Read current file to confirm starting state**

Read `~/.claude/skills/continue-session/SKILL.md`. Confirm line 1 is `# Continue Session` (no frontmatter yet).

- [ ] **Step 2: Add frontmatter at top of file**

The file currently starts with:
```
# Continue Session
```

Replace that opening with:
```markdown
---
name: continue-session
description: Use when the user wants to end a session and continue in a new one — generates a structured handoff prompt capturing context, decisions, and next steps, then copies it to clipboard.
---

# Continue Session
```

- [ ] **Step 3: Add Announce line after opening paragraph**

The opening paragraph ends with: `...copies it to the clipboard so the user can paste it into a new session.`

After that paragraph (before `## Triggers`), insert:
```markdown

**Announce at start:** "I'm using the continue-session skill to prepare a session handoff prompt."
```

- [ ] **Step 4: Verify**

```bash
head -10 ~/.claude/skills/continue-session/SKILL.md
```

Expected output:
```
---
name: continue-session
description: Use when the user wants to end a session and continue in a new one — generates a structured handoff prompt capturing context, decisions, and next steps, then copies it to clipboard.
---

# Continue Session
```

Also confirm `Announce at start` line exists:
```bash
grep "Announce at start" ~/.claude/skills/continue-session/SKILL.md
```

Expected: one match.

---

### Task 3: Fix copy-command — Add Frontmatter, Announce, Extend Scan

**Files:**
- Modify: `~/.claude/skills/copy-command/SKILL.md`

**What to fix:**
1. Missing frontmatter
2. Missing `Announce at start` line
3. Scan range too narrow (3 prior turns → 10 prior turns)

- [ ] **Step 1: Read current file**

Read `~/.claude/skills/copy-command/SKILL.md`. Confirm: starts with `# Copy Command`, and contains `scan back up to 3 prior assistant turns`.

- [ ] **Step 2: Add frontmatter at top**

Replace opening:
```
# Copy Command
```

With:
```markdown
---
name: copy-command
description: Use when the user says "copy that command", "copy the last command", "copy to clipboard", or "/copy-command" — finds the most recent shell command in the conversation and copies it to clipboard prefixed with `!` for in-session execution.
---

# Copy Command
```

- [ ] **Step 3: Add Announce line after opening paragraph**

Opening paragraph ends with: `...prefixed with `!` so it can be pasted directly into Claude Code's prompt and run in-session.`

After that paragraph (before `## Triggers`), insert:
```markdown

**Announce at start:** "I'm using the copy-command skill to copy the last command to clipboard."
```

- [ ] **Step 4: Extend scan range**

Find:
```
2. If none found there, scan back up to 3 prior assistant turns
```

Replace with:
```
2. If none found there, scan back up to 10 prior assistant turns
```

- [ ] **Step 5: Verify all three changes**

```bash
head -10 ~/.claude/skills/copy-command/SKILL.md
```
Expected: frontmatter present.

```bash
grep "Announce at start" ~/.claude/skills/copy-command/SKILL.md
```
Expected: one match.

```bash
grep "scan back up to" ~/.claude/skills/copy-command/SKILL.md
```
Expected: `scan back up to 10 prior assistant turns`

---

### Task 4: Fix full-review — Add Frontmatter + Announce

**Files:**
- Modify: `~/.claude/skills/full-review/SKILL.md`

**What to fix:** Missing frontmatter and missing `Announce at start` line. No logic changes.

- [ ] **Step 1: Read current file**

Read `~/.claude/skills/full-review/SKILL.md`. Confirm starts with `# Full Review` (no frontmatter).

- [ ] **Step 2: Add frontmatter at top**

Replace opening:
```
# Full Review
```

With:
```markdown
---
name: full-review
description: Use when the user asks for a full, complete, or comprehensive review of a page, component, or recent changes — dispatches parallel agents across code quality, accessibility, UI/UX, and performance, plus inline SEO/security checks and a Playwright visual test.
---

# Full Review
```

- [ ] **Step 3: Add Announce line after opening paragraph**

Opening paragraph ends with: `...Works across any web project stack.`

After that paragraph (before `## Triggers`), insert:
```markdown

**Announce at start:** "I'm using the full-review skill to conduct a comprehensive multi-dimensional review."
```

- [ ] **Step 4: Verify**

```bash
head -10 ~/.claude/skills/full-review/SKILL.md
```
Expected: frontmatter present.

```bash
grep "Announce at start" ~/.claude/skills/full-review/SKILL.md
```
Expected: one match.

---

### Task 5: Fix split-diff-into-commits — Correct Co-Authored-By Model

**Files:**
- Modify: `~/.claude/skills/split-diff-into-commits/SKILL.md`

**What to fix:** Two example commit messages in the file use `Co-Authored-By: Claude Opus 4.6` — should be `Claude Sonnet 4.6`.

- [ ] **Step 1: Find all occurrences**

```bash
grep -n "Co-Authored-By" ~/.claude/skills/split-diff-into-commits/SKILL.md
```

Expected: 2 lines, both containing `Claude Opus 4.6`.

- [ ] **Step 2: Replace both occurrences**

Replace all instances of:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

With:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Use `replace_all: true` when editing to catch both occurrences in one pass.

- [ ] **Step 3: Verify**

```bash
grep -n "Co-Authored-By" ~/.claude/skills/split-diff-into-commits/SKILL.md
```

Expected: 2 lines, both now containing `Claude Sonnet 4.6`. Zero lines with `Opus`.

```bash
grep "Opus" ~/.claude/skills/split-diff-into-commits/SKILL.md
```

Expected: no output.

---

### Task 6: Fix decompose-plan-tasks — Replace Prose Question with AskUserQuestion

**Files:**
- Modify: `~/.claude/skills/decompose-plan-tasks/SKILL.md`

**What to fix:** Step 6 "Present and Offer Dispatch" currently tells the AI to ask a prose question. Skills should instruct the AI to use the `AskUserQuestion` tool for structured choice UI.

- [ ] **Step 1: Read the current Step 6 ask block**

Read `~/.claude/skills/decompose-plan-tasks/SKILL.md` around lines 165–185. The block to replace looks like:

```markdown
Then ask:

**"Plan updated with parallelization annotations. Would you like to:**
1. **Dispatch Wave 1 now** — I'll launch parallel agents for all Wave 1 tasks
2. **Save for later** — The annotations are persisted in the plan file for future execution
3. **Review first** — Let me show you the updated plan before deciding"
```

- [ ] **Step 2: Replace prose question with AskUserQuestion instruction**

Replace the block identified in Step 1 with:

```markdown
Then call `AskUserQuestion` with one question:

```json
{
  "questions": [{
    "question": "Plan updated with parallelization annotations. What would you like to do next?",
    "header": "Next step",
    "multiSelect": false,
    "options": [
      {
        "label": "Dispatch Wave 1 now",
        "description": "Launch parallel agents immediately for all Wave 1 tasks"
      },
      {
        "label": "Save for later",
        "description": "Annotations are persisted in the plan file for future execution"
      },
      {
        "label": "Review first",
        "description": "Show the updated plan before deciding"
      }
    ]
  }]
}
```
```

- [ ] **Step 3: Verify replacement**

```bash
grep -n "AskUserQuestion\|Would you like\|prose" ~/.claude/skills/decompose-plan-tasks/SKILL.md
```

Expected: `AskUserQuestion` present, `Would you like` absent.

- [ ] **Step 4: Verify downstream logic still references the same three outcomes**

Read the "Dispatching (if chosen)" section that follows Step 6. Confirm it still references the three choices by name: "Dispatch Wave 1 now", "Save for later", "Review first". No changes needed there — the outcome labels match.

---

## Self-Review

**Spec coverage:**
- ✓ Task 1: all 7 stale plugins
- ✓ Task 2: continue-session frontmatter + announce
- ✓ Task 3: copy-command frontmatter + announce + extended scan
- ✓ Task 4: full-review frontmatter + announce
- ✓ Task 5: split-diff-into-commits Co-Authored-By
- ✓ Task 6: decompose-plan-tasks AskUserQuestion

**Placeholder scan:** No TBDs, no "implement later", no vague steps. Each step has exact file path, exact string to find, exact replacement.

**Type consistency:** No shared types — all markdown file edits. No cross-task naming dependencies.
