# Chrome Tabs 分组操作与 Side Panel 关闭优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在域名分组视图中增加分组隐私/关闭与一键折叠展开，并让侧边箭头真正关闭 Chrome Side Panel。

**Architecture:** 保持 App 作为 Chrome tabs 数据与操作编排层；DomainGroup 只负责分组标题操作与 TabRow 渲染；新增的确认交互使用原生 `window.confirm`，让关闭操作在确认前绝不触碰 Chrome API。DrawerToggle 只发出关闭请求，App 通过安全 API 适配器调用 `chrome.sidePanel.close({windowId})`。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Chrome MV3 Side Panel API, tldts。

---

### Task 1: 更新偏好、Chrome API 和 Manifest

**Files:**
- Modify: `src/types.ts`
- Modify: `src/preferences/uiPreferences.ts`
- Modify: `src/preferences/uiPreferences.test.ts`
- Modify: `src/chrome/chromeTabs.ts`
- Modify: `src/chrome/chromeTabs.test.ts`
- Modify: `public/manifest.json`
- Modify: `src/manifest.test.ts`

- [ ] **Step 1: Write failing tests**
  - 断言偏好默认/解析/保存结果不再包含 `drawerCollapsed`。
  - 为 Chrome tabs adapter 增加 `closeSidePanel(windowId)`，调用 `chrome.sidePanel.close({ windowId })`。
  - 断言 manifest `minimum_chrome_version` 为 `141`。

- [ ] **Step 2: Run targeted tests and verify failure**
  - Run `npm test -- src/preferences/uiPreferences.test.ts src/chrome/chromeTabs.test.ts src/manifest.test.ts`。
  - Expected: 新增断言因字段/API/版本尚未实现而失败。

- [ ] **Step 3: Implement minimal adapter changes**
  - 删除 UiPreferences 的 `drawerCollapsed` 类型和校验/保存字段；旧存储对象继续只读取已知字段。
  - 在 `ChromeTabsApi` 增加 `closeSidePanel(windowId: number): Promise<void>`。
  - 安全适配器检查 `chrome.sidePanel.close` 后调用 `chrome.sidePanel.close({ windowId })`，缺失时 reject 通用错误。
  - 更新 manifest 最低版本和相关测试。

- [ ] **Step 4: Run targeted tests**
  - Run the same targeted command; expected all pass。

---

### Task 2: 分组操作领域函数与 DomainGroup UI

**Files:**
- Modify: `src/types.ts`
- Modify: `src/domain/tabs.ts`
- Modify: `src/domain/tabs.test.ts`
- Modify: `src/components/DomainGroup.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests**
  - 为 DisplayDomainGroup 增加 `allMasked` 或等价的计算字段，确认显示组可决定隐藏图标状态。
  - 组件测试/集成测试断言分组标题存在隐藏和关闭按钮，点击按钮不会触发折叠按钮。

- [ ] **Step 2: Run targeted tests and verify failure**
  - Run `npm test -- src/domain/tabs.test.ts src/App.test.tsx`。
  - Expected: 新增分组操作断言失败。

- [ ] **Step 3: Implement minimal UI**
  - DomainGroup 标题使用独立操作区，增加分组隐私按钮与分组关闭按钮。
  - `onToggleGroupMask(group)` 与 `onCloseGroup(group)` 由 props 提供。
  - 关闭按钮阻止冒泡，保留动态 aria-label，pending 时禁用。
  - 使用既有 Icon（eye/eye-off/close）和窄宽度 CSS。

- [ ] **Step 4: Run targeted tests**
  - Run `npm test -- src/domain/tabs.test.ts src/App.test.tsx`。

---

### Task 3: App 编排：分组隐藏、二次确认关闭、全部折叠/展开、真正关闭 Side Panel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx` or `src/components/SearchFilters.tsx`
- Modify: `src/components/DrawerToggle.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing integration tests**
  - 分组模式下点击分组眼睛图标只将该分组当前可见 tabs 设为 masked，并且全局 visible 状态不变。
  - 关闭分组第一次点击只弹确认；取消或 confirm=false 时不调用 `closeTab`。
  - confirm=true 后为当前分组所有可见 tabs 调用 `closeTab`。
  - 一键全部折叠/展开切换所有当前可见 group disclosure 的 `aria-expanded`。
  - Drawer arrow 调用 `closeSidePanel(focusedWindowId)`，不再渲染 drawer-content 的 `aria-hidden`/`inert`，不再保存 collapsed 状态。
  - closeSidePanel 失败显示通用错误而不泄露异常信息。

- [ ] **Step 2: Run App tests and verify failure**
  - Run `npm test -- src/App.test.tsx`。
  - Expected: 新增断言失败。

- [ ] **Step 3: Implement minimal App wiring**
  - 删除 drawerCollapsed state/effect/class wrapper behavior；DrawerToggle 改为 `onClose`。
  - 以 `effectiveFocusedWindowId` 调用 `resolvedApi.closeSidePanel`，无有效窗口时显示安全错误。
  - 增加 `handleDomainGroupMask(group)`：遍历 `group.tabs` 写入 true；全局已 hidden 时 no-op。
  - 增加 `handleDomainGroupClose(group)`：先 `window.confirm(`关闭该分组中的 ${group.tabs.length} 个标签页？`)`，确认后逐个关闭可见 tab；复用 pending 集合并在成功后清理 overrides。失败显示 `无法关闭该分组，请重试。`。
  - 增加 `handleToggleAllDomainGroups`：比较当前可见组 collapsed 状态，全部折叠或清除当前组 keys。
  - 在 domain 视图工具栏渲染全折叠/展开按钮。

- [ ] **Step 4: Run App tests**
  - Run `npm test -- src/App.test.tsx`。

---

### Task 4: 文档、样式与最终验证

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-19-chrome-tabs-group-actions-sidepanel-close-design.md`
- Modify: `docs/superpowers/plans/2026-07-19-chrome-tabs-group-actions-sidepanel-close.md`

- [ ] **Step 1: Update copy and CSS contract tests**
  - 移除 drawer collapsed CSS 与旧文案。
  - 保留小型固定关闭按钮样式，说明其调用 Chrome 关闭 API。
  - 更新 README 安装与行为说明。

- [ ] **Step 2: Run full verification**
  - `npm test`
  - `npm run lint`
  - `npm run build`

- [ ] **Step 3: Review final diff**
  - 确认 dist 无 `drawerCollapsed` 逻辑，无旧“不调用 close”文案，无敏感异常文本。
  - 确认权限仍最小化，Manifest MV3，`minimum_chrome_version: 141`。
