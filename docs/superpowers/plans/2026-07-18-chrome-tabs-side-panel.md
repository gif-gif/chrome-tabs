# Chrome Tabs Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 React + Vite + Manifest V3 Chrome 插件，在 Side Panel 中提供可搜索、筛选、按窗口分组、实时同步且支持全局与单标签脱敏的标签页管理体验。

**Architecture:** Side Panel React 应用通过一个窄接口的 Chrome adapter 读取和操作 tabs/windows；纯函数模块负责排序、筛选和脱敏展示模型，从而将隐私逻辑与 Chrome API 副作用隔离。Manifest V3 background service worker 只负责配置工具栏 action 打开 Side Panel，React hook 负责注册 Chrome 事件并合并刷新。

**Tech Stack:** React 19、TypeScript、Vite、@vitejs/plugin-react、Chrome Extension Manifest V3、Vitest、React Testing Library、jsdom、原生 CSS

---

## File Map

- `package.json` — 开发、测试、构建脚本和依赖。
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript 配置。
- `vite.config.ts` — Vite 多入口构建及 Vitest/jsdom 配置。
- `eslint.config.js` — TypeScript/React 静态检查规则。
- `index.html` — Side Panel 的 Vite HTML 入口。
- `public/manifest.json` — Manifest V3、权限、side panel 与 service worker 声明。
- `public/background.js` — 工具栏 action 打开 Side Panel。
- `public/icons/*` — 本地扩展图标。
- `src/main.tsx` — React 挂载入口。
- `src/App.tsx` — 页面状态组合、搜索筛选与操作编排。
- `src/styles.css` — 主题 token、响应式 Side Panel 布局和交互状态。
- `src/types.ts` — tab/window/filter/view model 类型。
- `src/chrome/chromeTabs.ts` — Chrome API adapter 与事件订阅。
- `src/chrome/chromeTabs.test.ts` — adapter 行为测试。
- `src/domain/tabs.ts` — 排序、搜索、筛选和脱敏纯函数。
- `src/domain/tabs.test.ts` — 领域逻辑单元测试。
- `src/hooks/useChromeTabs.ts` — 初始查询、实时同步、合并刷新与错误状态。
- `src/hooks/useChromeTabs.test.tsx` — hook 事件和清理测试。
- `src/components/Icon.tsx` — 项目内一致的 SVG 图标集合。
- `src/components/Header.tsx` — 标题、计数和全局脱敏控制。
- `src/components/SearchFilters.tsx` — 搜索和三种筛选。
- `src/components/WindowGroup.tsx` — 可折叠窗口组。
- `src/components/TabRow.tsx` — 标签页展示、切换、关闭和单项脱敏。
- `src/components/StatusView.tsx` — 加载、空状态、错误重试和 aria-live 提示。
- `src/App.test.tsx` — 主要用户交互组件测试。
- `src/test/setup.ts` — jest-dom 与测试清理配置。
- `src/test/fixtures.ts` — 可复用测试 tabs/windows 数据。
- `README.md` — 安装、构建、加载和隐私说明。

## Shared Interfaces Locked by This Plan

```ts
export type TabFilter = 'all' | 'current-window' | 'active';

export interface BrowserTab {
  id: number;
  windowId: number;
  index: number;
  active: boolean;
  title: string;
  url: string;
  favIconUrl?: string;
}

export interface BrowserWindow {
  id: number;
  focused: boolean;
  tabs: BrowserTab[];
}

export interface DisplayTab extends BrowserTab {
  masked: boolean;
  displayTitle: string;
  displayUrl: string;
  displayFavIconUrl?: string;
}

export interface DisplayWindow {
  id: number;
  focused: boolean;
  label: string;
  tabs: DisplayTab[];
}

export interface ChromeTabsApi {
  queryWindows(): Promise<BrowserWindow[]>;
  activateTab(tabId: number, windowId: number): Promise<void>;
  closeTab(tabId: number): Promise<void>;
  subscribe(listener: () => void): () => void;
}
```

---

### Task 1: Scaffold React/Vite Extension and Establish the Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Create dependency and compiler configuration**

Create `package.json` with exact scripts and dependencies:

```json
{
  "name": "chrome-tabs-side-panel",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@types/chrome": "^0.1.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@testing-library/jest-dom": "^6.6.4",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^4.7.0",
    "eslint": "^9.32.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "jsdom": "^26.1.0",
    "typescript": "~5.8.3",
    "typescript-eslint": "^8.39.0",
    "vite": "^7.0.6",
    "vitest": "^3.2.4"
  }
}
```

Create project references in `tsconfig.json`, browser compiler options in `tsconfig.app.json` (`ES2022`, `DOM`, `react-jsx`, strict mode, Chrome types), and Node/Vite options in `tsconfig.node.json`.

- [ ] **Step 2: Create Vite, ESLint, and HTML configuration**

Configure `vite.config.ts` so build output is `dist`, public assets are copied, and Vitest uses `jsdom`, `globals: true`, and `src/test/setup.ts`. Configure ESLint for TypeScript and React hooks. Create `index.html` with `<div id="root"></div>` and `/src/main.tsx` module script.

- [ ] **Step 3: Write the first failing render test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the extension heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '标签页管理器' })).toBeInTheDocument();
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Install packages and verify the test fails**

Run: `npm install`

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because `App`/heading does not exist yet.

- [ ] **Step 5: Implement the minimal React shell**

Create `src/App.tsx`:

```tsx
export function App() {
  return <h1>标签页管理器</h1>;
}
```

Create `src/main.tsx` to render `<App />` inside `StrictMode`.

- [ ] **Step 6: Verify the shell test passes**

Run: `npm test -- --run src/App.test.tsx`

Expected: PASS, 1 test.

- [ ] **Step 7: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig*.json vite.config.ts eslint.config.js index.html src/main.tsx src/App.tsx src/App.test.tsx src/test/setup.ts
git commit -m "chore: scaffold React side panel extension"
```

If the directory is still not a Git repository, skip only the commit command and record that fact; do not initialize Git without user instruction.

---

### Task 2: Add Manifest V3 Side Panel Wiring

**Files:**
- Create: `public/manifest.json`
- Create: `public/background.js`
- Create: `public/icons/icon-16.png`
- Create: `public/icons/icon-32.png`
- Create: `public/icons/icon-48.png`
- Create: `public/icons/icon-128.png`
- Test: `src/manifest.test.ts`

- [ ] **Step 1: Write failing manifest contract tests**

Create `src/manifest.test.ts` that reads `public/manifest.json` and asserts:

```ts
expect(manifest.manifest_version).toBe(3);
expect(manifest.permissions).toEqual(expect.arrayContaining(['tabs', 'sidePanel']));
expect(manifest.side_panel.default_path).toBe('index.html');
expect(manifest.background.service_worker).toBe('background.js');
```

Also read `public/background.js` and assert it contains `chrome.sidePanel.setPanelBehavior` with `openPanelOnActionClick: true`.

- [ ] **Step 2: Run the manifest test to verify it fails**

Run: `npm test -- --run src/manifest.test.ts`

Expected: FAIL because manifest assets do not exist.

- [ ] **Step 3: Create the extension manifest and service worker**

Create `public/manifest.json` with:

```json
{
  "manifest_version": 3,
  "name": "标签页管理器",
  "version": "0.1.0",
  "description": "在浏览器侧边栏中快速搜索、切换和管理标签页。",
  "permissions": ["tabs", "sidePanel"],
  "side_panel": { "default_path": "index.html" },
  "background": { "service_worker": "background.js" },
  "action": {
    "default_title": "打开标签页管理器",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Create `public/background.js`:

```js
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
```

Generate four local PNG icons from one simple stacked-tabs source design; do not load any remote asset.

- [ ] **Step 4: Verify manifest contract and production build**

Run: `npm test -- --run src/manifest.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: exit 0 and `dist/manifest.json`, `dist/background.js`, `dist/index.html` exist.

- [ ] **Step 5: Commit extension wiring**

```bash
git add public src/manifest.test.ts
git commit -m "feat: configure manifest v3 side panel"
```

Skip commit if no Git repository exists.

---

### Task 3: Implement Domain Types, Search, Filters, Sorting, and Privacy Projection

**Files:**
- Create: `src/types.ts`
- Create: `src/domain/tabs.ts`
- Create: `src/domain/tabs.test.ts`
- Create: `src/test/fixtures.ts`

- [ ] **Step 1: Define shared types and fixtures**

Add the interfaces locked in “Shared Interfaces” to `src/types.ts`. Add fixture windows to `src/test/fixtures.ts`: focused window 10 with active GitHub tab and inactive mail tab; unfocused window 20 with active docs tab. Include titles, URLs, indexes, and favicon URLs.

- [ ] **Step 2: Write failing tests for sorting and filtering**

In `src/domain/tabs.test.ts`, assert:

```ts
expect(sortWindowsCurrentFirst(windows, 20)[0].id).toBe(20);
expect(filterWindows(windows, { query: 'github', filter: 'all', focusedWindowId: 10 })[0].tabs).toHaveLength(1);
expect(filterWindows(windows, { query: 'TOKEN=SECRET', filter: 'all', focusedWindowId: 10 })[0].tabs[0].url).toContain('TOKEN=SECRET');
expect(filterWindows(windows, { query: '', filter: 'current-window', focusedWindowId: 10 }).map(w => w.id)).toEqual([10]);
expect(filterWindows(windows, { query: '', filter: 'active', focusedWindowId: 10 }).flatMap(w => w.tabs).every(tab => tab.active)).toBe(true);
```

- [ ] **Step 3: Run the domain tests and verify they fail**

Run: `npm test -- --run src/domain/tabs.test.ts`

Expected: FAIL because domain functions do not exist.

- [ ] **Step 4: Implement minimal sorting and filtering functions**

Export from `src/domain/tabs.ts`:

```ts
sortWindowsCurrentFirst(windows, focusedWindowId)
filterWindows(windows, { query, filter, focusedWindowId })
```

Normalize query with `trim().toLocaleLowerCase()` and match both `title` and `url`. Preserve original window/tab objects except for copied filtered tab arrays. Remove empty groups.

- [ ] **Step 5: Run sorting/filtering tests to green**

Run: `npm test -- --run src/domain/tabs.test.ts`

Expected: current tests PASS.

- [ ] **Step 6: Write failing privacy projection tests**

Add tests for:

```ts
expect(resolveMasked(true, new Map(), 1)).toBe(true);
expect(resolveMasked(true, new Map([[1, false]]), 1)).toBe(false);
expect(resolveMasked(false, new Map([[1, true]]), 1)).toBe(true);
```

Test `createDisplayWindows` so a masked tab has `displayTitle === '内容已隐藏'`, empty `displayUrl`, and `displayFavIconUrl === undefined`; verify serialized masked view model does not contain its original title, URL, or favicon. Verify an unmasked tab preserves all three values.

- [ ] **Step 7: Run privacy tests to verify they fail**

Run: `npm test -- --run src/domain/tabs.test.ts`

Expected: FAIL because privacy functions do not exist.

- [ ] **Step 8: Implement privacy projection**

Implement:

```ts
resolveMasked(globalMasked, overrides, tabId)
createDisplayWindowsPresentationContext(allWindows, focusedWindowId)
createDisplayWindows(windows, globalMasked, overrides, presentationContext)
```

Label windows as `当前窗口` for focused window and `窗口 N` for others after sorting. The masked projection must not copy private fields into alternate display properties.

- [ ] **Step 9: Verify all domain tests pass**

Run: `npm test -- --run src/domain/tabs.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit domain logic**

```bash
git add src/types.ts src/domain src/test/fixtures.ts
git commit -m "feat: add tab filtering and privacy domain logic"
```

Skip commit if no Git repository exists.

---

### Task 4: Build and Test the Chrome API Adapter

**Files:**
- Create: `src/chrome/chromeTabs.ts`
- Create: `src/chrome/chromeTabs.test.ts`

- [ ] **Step 1: Write failing query normalization test**

Mock `globalThis.chrome` with `windows.getAll({ populate: true, windowTypes: ['normal'] })`. Include incomplete tabs and assert `queryWindows()` drops tabs without numeric `id/windowId`, normalizes missing title/URL to empty strings, sorts tabs by index, and returns only numeric window IDs.

- [ ] **Step 2: Run adapter query test to verify it fails**

Run: `npm test -- --run src/chrome/chromeTabs.test.ts`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement `queryWindows` and API availability check**

Export `createChromeTabsApi(chromeApi = globalThis.chrome): ChromeTabsApi`. Throw `Chrome 扩展 API 不可用，请在 Chrome 扩展环境中打开。` when required APIs are absent. Implement `queryWindows()` using `chrome.windows.getAll({ populate: true, windowTypes: ['normal'] })` and map to `BrowserWindow[]`.

- [ ] **Step 4: Verify query test passes**

Run: `npm test -- --run src/chrome/chromeTabs.test.ts`

Expected: query normalization test PASS.

- [ ] **Step 5: Write failing operation and subscription tests**

Assert `activateTab(7, 20)` calls, in order:

```ts
chrome.tabs.update(7, { active: true });
chrome.windows.update(20, { focused: true });
```

Assert `closeTab(7)` calls `chrome.tabs.remove(7)`. For `subscribe`, mock every event listed in the design spec, verify the same listener is registered, invoke returned cleanup, and verify every event removes it.

- [ ] **Step 6: Run operation/subscription tests to verify they fail**

Run: `npm test -- --run src/chrome/chromeTabs.test.ts`

Expected: FAIL for unimplemented methods.

- [ ] **Step 7: Implement operations and all event subscriptions**

Subscribe to tab created/updated/moved/activated/removed/attached/detached/replaced and window created/removed/focus changed. Return one cleanup closure. Wrap callback-based or Promise Chrome methods consistently as Promises and propagate errors.

- [ ] **Step 8: Verify adapter tests pass**

Run: `npm test -- --run src/chrome/chromeTabs.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit adapter**

```bash
git add src/chrome
git commit -m "feat: add Chrome tabs API adapter"
```

Skip commit if no Git repository exists.

---

### Task 5: Implement the Real-Time Chrome Tabs Hook

**Files:**
- Create: `src/hooks/useChromeTabs.ts`
- Create: `src/hooks/useChromeTabs.test.tsx`

- [ ] **Step 1: Write failing initial-load and retry tests**

Render a test harness using `useChromeTabs(fakeApi)`. Verify initial state is loading, resolved windows render after `queryWindows`, rejected query renders the exact error, and calling `refresh()` clears the error after a later successful response.

Expected hook contract:

```ts
interface UseChromeTabsResult {
  windows: BrowserWindow[];
  focusedWindowId?: number;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}
```

- [ ] **Step 2: Run hook tests to verify they fail**

Run: `npm test -- --run src/hooks/useChromeTabs.test.tsx`

Expected: FAIL because hook does not exist.

- [ ] **Step 3: Implement initial loading, focus derivation, error, and retry**

Use the focused window from the latest `queryWindows()` result to derive `focusedWindowId`. Preserve the last valid `windows` array when a refresh fails. Ensure state is not updated after unmount.

- [ ] **Step 4: Verify initial-load tests pass**

Run: `npm test -- --run src/hooks/useChromeTabs.test.tsx`

Expected: initial loading/error/retry tests PASS.

- [ ] **Step 5: Write failing event coalescing and cleanup tests**

Capture the listener passed to `fakeApi.subscribe`. Trigger it three times synchronously and use fake timers to assert only one additional `queryWindows()` occurs after a 40 ms debounce. Unmount and verify the cleanup function runs and queued refresh is cancelled.

- [ ] **Step 6: Run real-time tests to verify they fail**

Run: `npm test -- --run src/hooks/useChromeTabs.test.tsx`

Expected: FAIL for missing subscription/debounce behavior.

- [ ] **Step 7: Implement subscribed, coalesced refresh**

Register once in an effect, schedule refresh using a 40 ms timeout, replace any queued timeout, and clear/unsubscribe on unmount. Keep `refresh` stable with `useCallback`.

- [ ] **Step 8: Verify all hook tests pass**

Run: `npm test -- --run src/hooks/useChromeTabs.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit the hook**

```bash
git add src/hooks
git commit -m "feat: synchronize tabs with Chrome events"
```

Skip commit if no Git repository exists.

---

### Task 6: Build Accessible Presentational Components

**Files:**
- Create: `src/components/Icon.tsx`
- Create: `src/components/Header.tsx`
- Create: `src/components/SearchFilters.tsx`
- Create: `src/components/TabRow.tsx`
- Create: `src/components/WindowGroup.tsx`
- Create: `src/components/StatusView.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Replace shell test with failing header/search/filter tests**

Render a temporary component harness and assert:

- heading `标签页管理器` and text `3 个标签页` exist;
- global privacy button has label `显示全部标签信息` when masked;
- search has accessible name `搜索标签页`;
- filter buttons `全部`, `当前窗口`, `活动标签` exist and selected filter has `aria-pressed="true"`;
- typing and clicking filters call their callbacks.

- [ ] **Step 2: Run component tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement icons, header, search, and filters**

`Icon.tsx` exposes SVG icons for search, close, eye, eye-off, chevron, tab, refresh, and clear. SVGs use `currentColor`, `aria-hidden="true"`, and no Emoji. `Header` and `SearchFilters` use semantic buttons and dynamic labels. Search clear button is present only when query is non-empty; Escape clears it.

- [ ] **Step 4: Verify header/search/filter tests pass**

Run: `npm test -- --run src/App.test.tsx`

Expected: new tests PASS.

- [ ] **Step 5: Write failing tab row privacy and event isolation tests**

For a masked `DisplayTab`, assert:

- text is `内容已隐藏`;
- original title and URL are absent from document text;
- no image is rendered;
- row accessible name does not contain original data;
- privacy button label is `显示此标签信息`.

For an unmasked tab, assert title, URL, and favicon are rendered. Click the row and expect `onActivate`; click privacy/close buttons and assert only their own handlers fire.

- [ ] **Step 6: Run row tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because `TabRow` does not exist.

- [ ] **Step 7: Implement `TabRow` without privacy leaks**

Use a main `<button className="tab-main">` for activation and sibling icon buttons for privacy/close, avoiding nested buttons. Do not assign hidden title, URL, or favicon to `title`, `aria-label`, `data-*`, CSS custom properties, or hidden nodes. Give the masked main button the generic label `切换到隐藏的标签页`.

- [ ] **Step 8: Verify tab row tests pass**

Run: `npm test -- --run src/App.test.tsx`

Expected: row tests PASS.

- [ ] **Step 9: Write failing window group and status tests**

Assert window group header exposes `aria-expanded`, toggles collapse, and displays filtered count. Assert `StatusView` renders loading text, no-result guidance, API error text with `重试` button, and a `role="status"` operation message.

- [ ] **Step 10: Implement `WindowGroup` and `StatusView`**

Compose `TabRow` inside `WindowGroup`; when collapsed, do not render its tab rows. Implement distinct loading, empty, fatal error, and non-blocking operation feedback states.

- [ ] **Step 11: Verify all presentational component tests pass**

Run: `npm test -- --run src/App.test.tsx`

Expected: PASS.

- [ ] **Step 12: Commit presentational components**

```bash
git add src/components src/App.test.tsx
git commit -m "feat: add accessible tab manager components"
```

Skip commit if no Git repository exists.

---

### Task 7: Integrate App State, Privacy Controls, and Chrome Operations

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write failing app integration tests for initial projection**

Inject a `ChromeTabsApi` into `<App api={fakeApi} />`. After load, assert:

- focused window group appears first and is labeled `当前窗口`;
- all rows are masked by default;
- header count matches all tabs;
- original titles, URLs, and favicon images are absent.

- [ ] **Step 2: Run integration test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because App is still a shell.

- [ ] **Step 3: Integrate hook, domain pipeline, and UI**

In `App.tsx`, create state:

```ts
const [query, setQuery] = useState('');
const [filter, setFilter] = useState<TabFilter>('all');
const [collapsedWindowIds, setCollapsedWindowIds] = useState<Set<number>>(new Set());
const [globalMasked, setGlobalMasked] = useState(true);
const [tabMaskOverrides, setTabMaskOverrides] = useState<Map<number, boolean>>(new Map());
const [operationMessage, setOperationMessage] = useState<string | null>(null);
```

Apply `sortWindowsCurrentFirst` → `filterWindows` → `createDisplayWindows` with `useMemo`, then render Header, SearchFilters, WindowGroup, and StatusView.

- [ ] **Step 4: Verify initial projection passes**

Run: `npm test -- --run src/App.test.tsx`

Expected: initial integration test PASS.

- [ ] **Step 5: Write failing global and per-tab privacy tests**

Verify:

1. Global show reveals all titles/URLs/favicons.
2. Per-tab hide hides only one tab while global show remains active.
3. Global hide hides all tabs and clears prior per-tab exceptions.
4. Per-tab show reveals only one tab under global hide.
5. A later global show reveals all tabs, proving overrides were cleared.

- [ ] **Step 6: Run privacy integration tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL for missing privacy handlers.

- [ ] **Step 7: Implement global and per-tab privacy handlers**

Global handler:

```ts
setGlobalMasked(value => !value);
setTabMaskOverrides(new Map());
```

Per-tab handler computes the current resolved value and stores its inverse. Add an effect that removes overrides for IDs no longer present after real-time refresh.

- [ ] **Step 8: Verify privacy integration tests pass**

Run: `npm test -- --run src/App.test.tsx`

Expected: privacy tests PASS.

- [ ] **Step 9: Write failing search/filter/collapse tests**

Assert search is case-insensitive across title and full URL even when masked, but matching rows remain hidden. Assert current-window and active filters combine with query. Assert collapsed groups hide rows and retain their state across a data refresh while the window still exists.

- [ ] **Step 10: Implement search/filter/collapse state handlers**

Wire SearchFilters callbacks and immutable Set updates for group collapse. Remove collapsed IDs for windows that no longer exist.

- [ ] **Step 11: Verify search/filter/collapse tests pass**

Run: `npm test -- --run src/App.test.tsx`

Expected: tests PASS.

- [ ] **Step 12: Write failing activate/close/error tests**

Assert row activation calls `api.activateTab(tabId, windowId)`, close calls `api.closeTab(tabId)`, successful close clears any override for that tab, and rejected operations show generic non-private feedback then call `refresh()`.

- [ ] **Step 13: Implement operations and feedback**

Catch adapter errors and display `无法切换到该标签页，请重试。` or `无法关闭该标签页，请重试。`; do not include tab title or URL. Clear operation feedback on the next successful operation.

- [ ] **Step 14: Verify all App tests pass**

Run: `npm test -- --run src/App.test.tsx`

Expected: PASS.

- [ ] **Step 15: Wire production adapter in `main.tsx` and commit integration**

Create the adapter once and pass it to `<App api={api} />`. If creation fails, allow App to render the API-unavailable error state via an unavailable adapter or explicit initialization error prop.

```bash
git add src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat: integrate tab management and privacy controls"
```

Skip commit if no Git repository exists.

---

### Task 8: Apply the Responsive Chrome-Native Visual System

**Files:**
- Create: `src/styles.css`
- Modify: `src/main.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing semantic class/state assertions**

Add focused tests that verify current active tab exposes both text `当前标签` and class/state hook `is-active`; destructive close button has a clear label; main list uses a semantic list; and operation status uses `aria-live="polite"`.

- [ ] **Step 2: Run accessibility/state tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL for missing semantic hooks or labels.

- [ ] **Step 3: Implement CSS tokens and layout**

Create `src/styles.css` with semantic tokens for light/dark backgrounds, surfaces, text, borders, accent, danger, focus ring, hover and active states. Style:

- sticky compact header and search/filter controls;
- 280–600 px adaptive layout;
- horizontal overflow limited to filter chips, never the whole page;
- 52–60 px tab rows;
- 36 px minimum icon button hit areas;
- truncation for visible title/URL;
- active tab left accent plus `当前标签` text;
- hover/focus-visible/pressed states without layout shift;
- `prefers-color-scheme: dark` and `prefers-reduced-motion: reduce`.

Import stylesheet in `main.tsx`.

- [ ] **Step 4: Implement missing semantic/state hooks**

Use `<ul>`/`<li>` for tab collections, provide `aria-live="polite"`, and ensure all icon buttons have dynamic Chinese labels. Images use empty alt text because visible title identifies the site; masked rows render no image element.

- [ ] **Step 5: Verify component tests and lint**

Run: `npm test -- --run src/App.test.tsx`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0 with no errors.

- [ ] **Step 6: Commit styles and accessibility**

```bash
git add src/styles.css src/main.tsx src/components src/App.test.tsx
git commit -m "style: add responsive accessible side panel UI"
```

Skip commit if no Git repository exists.

---

### Task 9: Add Documentation and Complete Automated Verification

**Files:**
- Create: `README.md`
- Modify: any files required by verification failures

- [ ] **Step 1: Write README usage and privacy documentation**

Document exact commands:

```bash
npm install
npm test
npm run lint
npm run build
```

Document Chrome loading steps: open `chrome://extensions`, enable Developer mode, choose Load unpacked, select the absolute project `dist` directory, pin/click the extension icon, and use the Side Panel. Explain required permissions, no host permissions, no remote data transmission, default masking, global reset semantics, per-tab overrides, and session-only privacy state.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all suites and tests PASS with zero failures.

- [ ] **Step 3: Run static analysis**

Run: `npm run lint`

Expected: exit 0 and zero lint errors.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: exit 0. Confirm `dist/index.html`, hashed JS/CSS assets, `dist/manifest.json`, `dist/background.js`, and all four icons exist.

- [ ] **Step 5: Inspect the built manifest and forbid remote assets**

Run:

```bash
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('dist/manifest.json','utf8'));if(m.manifest_version!==3||!m.permissions.includes('tabs')||!m.permissions.includes('sidePanel'))process.exit(1);console.log('manifest ok')"
rg -n "https?://" dist --glob '!*.map'
```

Expected: first command prints `manifest ok`; second command returns no matches (exit 1 is expected for no matches), proving the built extension has no remote asset URL.

- [ ] **Step 6: Perform privacy regression inspection**

Run the focused privacy tests:

```bash
npm test -- --run src/domain/tabs.test.ts src/App.test.tsx
```

Expected: PASS, including assertions that masked display models and rendered DOM omit original title, URL, and favicon.

- [ ] **Step 7: Commit documentation and any verification fixes**

```bash
git add README.md .
git commit -m "docs: add setup and privacy documentation"
```

Skip commit if no Git repository exists.

---

### Task 10: Manual Chrome Acceptance Check

**Files:**
- Modify only if a defect is discovered; add a failing regression test before each fix.

- [ ] **Step 1: Load the unpacked extension**

Build with `npm run build`, open `chrome://extensions`, enable Developer mode, choose `Load unpacked`, and select:

```text
<项目目录>/dist
```

Expected: extension loads with no manifest or service worker errors.

- [ ] **Step 2: Verify Side Panel launch and baseline UI**

Click the extension toolbar icon.

Expected: Side Panel opens; all tab content starts masked; search and filters are visible; focused window is first; light/dark theme follows the OS/Chrome theme.

- [ ] **Step 3: Verify tab operations in multiple windows**

Create at least two normal Chrome windows with three tabs each. Activate and close tabs from the panel.

Expected: target tab/window receives focus, only the requested tab closes, and the list updates without manual refresh.

- [ ] **Step 4: Verify real-time event coverage**

Outside the panel, create, rename/load, move, activate, attach/detach between windows, replace if a browser flow causes replacement, and close tabs/windows.

Expected: groups, counts, order, active marker, and focused-window label update automatically.

- [ ] **Step 5: Verify privacy combinations and DOM**

Exercise: global show → one tab hide → global hide → one tab show → global show. Inspect Elements for a masked row.

Expected: global operations clear overrides; per-tab operations affect one row; masked row DOM/attributes contain neither original title, URL, nor favicon URL.

- [ ] **Step 6: Verify responsive and keyboard behavior**

Resize Side Panel narrow/wide, use Tab/Shift+Tab/Enter/Space/Escape, and test both color schemes if available.

Expected: no page-level horizontal scroll, controls remain reachable, focus ring is visible, group and tab actions work with keyboard, Escape clears search, and contrast remains readable.

- [ ] **Step 7: Run fresh final verification after any manual fixes**

Run:

```bash
npm test && npm run lint && npm run build
```

Expected: all commands exit 0. Do not claim completion without this fresh output.

