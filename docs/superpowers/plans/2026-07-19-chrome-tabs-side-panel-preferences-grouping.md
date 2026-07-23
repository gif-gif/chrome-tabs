# Chrome Tabs Side Panel Preferences and Domain Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make content visible by default with remembered global privacy preference, add list/domain view switching, keep the search tools sticky, and add an in-panel collapsible drawer rail.

**Architecture:** Add a small versioned local preference adapter and a pure domain grouping projection. Keep raw BrowserTab data inside App/domain functions, project only privacy-safe DisplayTab values to row components, and render either existing WindowGroup components or new DomainGroup components from the same filtered snapshot. The drawer is a presentation state on the React shell and never calls the Chrome Side Panel close API.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Chrome Extension Manifest V3, Vitest, React Testing Library, tldts (bundled Public Suffix parser), native CSS.

---

### Task 1: Versioned local UI preferences

**Files:**
- Create: `src/preferences/uiPreferences.ts`
- Create: `src/preferences/uiPreferences.test.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests for default visible state, parsing a complete stored value, rejecting malformed values, persisting global mask/view/drawer state, and surviving storage exceptions.
- [ ] Run `npm test -- --run src/preferences/uiPreferences.test.ts src/App.test.tsx` and verify the new assertions fail.
- [ ] Implement `UiPreferences`, `loadUiPreferences`, and `saveUiPreferences` with key `chrome-tabs.ui-preferences.v1`, version validation, defaults `{globalMasked:false, viewMode:'list', drawerCollapsed:false}`, and exception-safe localStorage access.
- [ ] Initialize App from the adapter, persist only the three global UI preferences, and keep per-tab mask overrides memory-only.
- [ ] Re-run focused tests and verify they pass.

### Task 2: Registrable-domain projection and domain groups

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types.ts`
- Modify: `src/domain/tabs.ts`
- Modify: `src/domain/tabs.test.ts`
- Create: `src/components/DomainGroup.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Install bundled runtime dependency `tldts`.
- [ ] Write failing domain tests for `docs.google.com`, `drive.google.com`, `www.google.com`, `xaa.bac.google.com`, `example.com.cn`, localhost, IPv4/IPv6, special schemes, invalid URLs, stable ordering, and privacy-safe group labels.
- [ ] Run focused domain tests and verify failure.
- [ ] Implement `getTabDomainGroupKey` and a `createDisplayDomainGroups` projection that groups the already filtered tabs, carries safe DisplayTab rows, preserves deterministic first-seen ordering, and masks group labels when global privacy is enabled.
- [ ] Add `DomainGroup` with count, collapse control, rows, activation/close/mask callbacks, and pending state.
- [ ] Wire the list/domain segmented control into App and persist the selected mode.
- [ ] Re-run domain and App tests and verify they pass.

### Task 3: Sticky compact toolbar and icon-only privacy controls

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/SearchFilters.tsx`
- Modify: `src/components/TabRow.tsx`
- Modify: `src/components/Icon.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests proving “标签页管理器” is absent, global/per-tab privacy buttons contain no visible copy, dynamic accessible names remain, and the toolbar contains the view switch.
- [ ] Run focused App tests and verify failure.
- [ ] Replace the heading with a compact sticky toolbar; retain count/status controls and icon-only privacy actions.
- [ ] Add CSS sticky positioning, backdrop/background, narrow-width layout, and focus-visible behavior without reducing existing hit targets.
- [ ] Re-run App tests and verify they pass.

### Task 4: In-panel drawer collapse rail

**Files:**
- Create: `src/components/DrawerToggle.tsx`
- Modify: `src/components/Icon.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests for the left-middle toggle, dynamic collapse/expand accessible names, hidden/inert content state, restored persisted state, and no Chrome close API usage.
- [ ] Run focused App tests and verify failure.
- [ ] Implement a drawer shell whose content translates to the right and whose left rail remains operable; persist `drawerCollapsed` with the existing preference adapter.
- [ ] Add reduced-motion styles and prevent hidden content from receiving pointer/keyboard interaction using conditional rendering or `inert`/`aria-hidden` semantics.
- [ ] Re-run App tests and verify they pass.

### Task 5: Documentation and full verification

**Files:**
- Modify: `README.md`
- Verify: `public/manifest.json`
- Verify: `build/validateDist.ts`

- [ ] Update README for default visible behavior, remembered global privacy, list/domain modes, domain rules, and drawer limitation.
- [ ] Run `npm test` and require every test to pass.
- [ ] Run `npm run lint` and require zero errors.
- [ ] Run `npm run build` and require TypeScript, Vite, and `validateDist` to pass.
- [ ] Inspect `dist/manifest.json` to confirm no unnecessary new permissions or host permissions.
- [ ] Run a final independent spec and code-quality review; fix all Critical/Important findings and repeat verification after changes.

## Plan self-review

- Spec coverage: every requirement maps to Tasks 1–5.
- Privacy invariant: domain labels are explicitly masked, not just Tab rows.
- Persistence scope: only global mask, view mode, and drawer state persist; per-tab overrides do not.
- Special URL behavior and Public Suffix parsing are testable and deterministic.
- No Git steps are included because the workspace is not a Git repository.
- No placeholders or deferred implementation items remain.
