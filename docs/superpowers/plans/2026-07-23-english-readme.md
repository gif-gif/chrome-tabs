# Concise English README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise English project introduction and bidirectional language navigation between the Chinese and English README files.

**Architecture:** Keep `README.md` as the complete Chinese documentation and add `README.en.md` as a shorter English entry point. Use relative Markdown links for language switching, and verify the document contract with repeatable shell assertions before committing.

**Tech Stack:** Markdown, POSIX shell assertions, Git

---

## File Structure

- Create `README.en.md`: concise English overview, features, setup, Chrome loading, privacy, and language support.
- Modify `README.md`: add a language navigation line immediately below the main heading.

### Task 1: Add bilingual README navigation and the concise English document

**Files:**
- Create: `README.en.md`
- Modify: `README.md:1-4`

- [ ] **Step 1: Run the document contract before implementation and verify RED**

Run:

```bash
test -f README.en.md && \
rg -q '^简体中文 \| \[English\]\(README\.en\.md\)$' README.md && \
rg -q '^\[简体中文\]\(README\.md\) \| English$' README.en.md
```

Expected: FAIL because `README.en.md` does not exist and the language navigation has not been added.

- [ ] **Step 2: Add language navigation to the Chinese README**

Insert this line immediately below `# Chrome 标签页管理器`:

```markdown
简体中文 | [English](README.en.md)
```

Keep one blank line between the navigation and the existing introduction.

- [ ] **Step 3: Create the concise English README**

Create `README.en.md` with exactly this content:

````markdown
# Chrome Tab Manager

[简体中文](README.md) | English

A local Chrome extension for managing large numbers of tabs from the Side Panel. Search, filter, switch, close, group, and protect tab information without sending browsing data to a remote service.

## Key Features

- Search tabs by title or URL and filter by all tabs, the current window, or active tabs.
- Switch to a tab, focus its window, or close it directly from the Side Panel.
- Stay synchronized with tab and window creation, updates, moves, activation, and removal.
- Choose between a window-based list and groups based on registrable domains such as `google.com`.
- Hide titles, URLs, and favicons globally, by domain group, or for individual tabs.
- Use a compact sticky toolbar with quick filters, view controls, privacy controls, and group collapse actions.
- Use the interface in Simplified Chinese or English.

## Requirements

- Chrome 141 or later
- Node.js and npm

## Install, Test, and Build

```bash
npm install
npm test
npm run lint
npm run build
```

The loadable Chrome extension is generated in `dist`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `<project-directory>/dist`.
5. Pin the extension if desired, then click its toolbar icon to open the Side Panel.

## Privacy

Tab content is visible by default on first use. Only the global privacy setting is persisted locally. Per-tab and per-group privacy overrides last only for the current Side Panel page.

The extension does not persist tab titles, URLs, favicons, search text, group expansion state, or individual privacy overrides. Its manifest permissions remain limited to `tabs`, `favicon`, and `sidePanel`, with no host permissions.

## Language Support

The Side Panel supports Simplified Chinese and English. It follows the browser language by default, falls back to English for unsupported languages, and also allows manual language selection.
````

- [ ] **Step 4: Run the document contract and verify GREEN**

Run:

```bash
test -f README.en.md && \
rg -q '^简体中文 \| \[English\]\(README\.en\.md\)$' README.md && \
rg -q '^\[简体中文\]\(README\.md\) \| English$' README.en.md && \
rg -q '^## Key Features$' README.en.md && \
rg -q '^## Load in Chrome$' README.en.md && \
rg -q '^## Privacy$' README.en.md && \
rg -q '^## Language Support$' README.en.md
```

Expected: PASS with exit code 0.

- [ ] **Step 5: Check scope, local paths, and Markdown size**

Run:

```bash
git diff --check && \
! rg -n '/Users/|Documents/work/dev|TBD|TODO' README.md README.en.md && \
lines=$(wc -l < README.en.md) && test "$lines" -ge 45 && test "$lines" -le 70 && \
git status --short
```

Expected:

- `git diff --check` exits 0.
- No local absolute paths, placeholders, or TODO markers are found.
- `README.en.md` contains 45–70 lines.
- Only `README.md`, `README.en.md`, and this already committed plan/spec history are involved in the implementation change.

- [ ] **Step 6: Run the existing project verification**

Run:

```bash
npm test && npm run lint && npm run build
```

Expected:

- 11 test files pass.
- 309 tests pass.
- ESLint exits 0.
- TypeScript, Vite production build, and `build/validateDist.ts` all exit 0.

- [ ] **Step 7: Commit the README changes**

```bash
git add README.md README.en.md
git commit -m "docs: add concise English README"
```

- [ ] **Step 8: Push and verify the remote commit**

```bash
git push origin main
local_head=$(git rev-parse HEAD)
remote_head=$(git ls-remote origin refs/heads/main | awk '{print $1}')
test "$local_head" = "$remote_head"
git status --short --branch
```

Expected: the push succeeds, local and remote hashes match, and `main` is clean and tracking `origin/main`.
