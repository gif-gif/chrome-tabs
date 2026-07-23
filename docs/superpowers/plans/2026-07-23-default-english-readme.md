# Default English README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the concise English document the repository-default `README.md` while preserving the complete Chinese document as `README.zh-CN.md` with working bidirectional language links.

**Architecture:** Move the two existing README documents into their final language-specific filenames instead of duplicating content. Change only the language-navigation line in each document, and compare the resulting files against the pre-change Git blobs to prove that the remaining content is unchanged.

**Tech Stack:** Markdown, POSIX shell assertions, Git

---

## File Structure

- Replace `README.md`: concise English documentation and GitHub default README.
- Create `README.zh-CN.md`: complete Chinese documentation moved from the previous `README.md`.
- Delete `README.en.md`: its English content moves to `README.md`.

### Task 1: Make English the default README

**Files:**
- Replace: `README.md`
- Create: `README.zh-CN.md`
- Delete: `README.en.md`

- [ ] **Step 1: Run the final filename/navigation contract and verify RED**

Run:

```bash
test "$(sed -n '1p' README.md)" = '# Chrome Tab Manager' && \
test "$(sed -n '2p' README.md)" = '[简体中文](README.zh-CN.md) | English' && \
test -f README.zh-CN.md && \
test ! -e README.en.md
```

Expected: FAIL because `README.md` is still Chinese, `README.zh-CN.md` does not exist, and `README.en.md` still exists.

- [ ] **Step 2: Move the README files into their final locations**

Run:

```bash
mv README.md README.zh-CN.md
mv README.en.md README.md
```

- [ ] **Step 3: Update only the language-navigation lines**

Change line 2 of `README.md` to:

```markdown
[简体中文](README.zh-CN.md) | English
```

Change line 2 of `README.zh-CN.md` to:

```markdown
简体中文 | [English](README.md)
```

Keep line 3 empty in both files.

- [ ] **Step 4: Run the complete README contract and verify GREEN**

Run:

```bash
set -e
test "$(sed -n '1p' README.md)" = '# Chrome Tab Manager'
test "$(sed -n '2p' README.md)" = '[简体中文](README.zh-CN.md) | English'
test "$(sed -n '3p' README.md)" = ''
test "$(sed -n '1p' README.zh-CN.md)" = '# Chrome 标签页管理器'
test "$(sed -n '2p' README.zh-CN.md)" = '简体中文 | [English](README.md)'
test "$(sed -n '3p' README.zh-CN.md)" = ''
test ! -e README.en.md
rg -q '^## Key Features$' README.md
rg -q '^## Requirements$' README.md
rg -q '^## Install, Test, and Build$' README.md
rg -q '^## Load in Chrome$' README.md
rg -q '^## Privacy$' README.md
rg -q '^## Language Support$' README.md
```

Expected: PASS with exit code 0.

- [ ] **Step 5: Prove that only the two navigation lines changed**

Before committing, compare the new files with the current HEAD blobs:

```bash
diff -u \
  <(git show HEAD:README.en.md | sed '2c[简体中文](README.zh-CN.md) | English') \
  README.md

diff -u \
  <(git show HEAD:README.md | sed '2c简体中文 | [English](README.md)') \
  README.zh-CN.md
```

Expected: both commands produce no diff and exit 0.

- [ ] **Step 6: Check Markdown hygiene and change scope**

Run:

```bash
git diff --check && \
! rg -n '/Users/|Documents/work/dev|TBD|TODO' README.md README.zh-CN.md && \
find . -maxdepth 1 -type f -name 'README*' -print | sort && \
git status --short
```

Expected:

- `git diff --check` exits 0.
- No local paths, sensitive placeholders, TODO, or TBD markers are found.
- The root contains only `README.md` and `README.zh-CN.md` as README files.
- The implementation scope contains only the README move/replacement.

- [ ] **Step 7: Run the full project verification**

Run:

```bash
npm test && npm run lint && npm run build
```

Expected:

- 11 test files pass.
- 309 tests pass.
- ESLint exits 0.
- TypeScript, Vite production build, and `build/validateDist.ts` exit 0.

- [ ] **Step 8: Commit the README migration**

```bash
git add README.md README.zh-CN.md README.en.md
git commit -m "docs: make English README the default"
```

Expected: the commit records the English default README, preserved Chinese README, and removal of `README.en.md` without unrelated files.
