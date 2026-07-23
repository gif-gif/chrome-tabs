# Chrome Tab Manager 紧凑工具栏布局实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Side Panel 工具栏压缩为两行：第一行承载计数、图标化筛选和辅助操作，第二行承载搜索与列表/分组视图切换，并让第二行在滚动时持续吸顶。

**Architecture:** 保持现有 React + Vite + TypeScript 架构。将筛选按钮、语言菜单、视图按钮和操作按钮拆成清晰的受控 UI 单元；复用现有 `useStickySearchProgress`，让第一行作为可收起 auxiliary 区域、第二行作为常驻 sticky search row。所有状态继续由 `App` 管理，语言菜单通过局部 React 状态、DOM ref 和键盘事件实现，不引入第三方 UI 或图标库。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS, css-tree

---

## 文件边界

### 修改

- `src/App.tsx`：重排工具栏 JSX，管理语言菜单开关/焦点保护，传递新的筛选与图标按钮接口。
- `src/components/Header.tsx`：将计数行与筛选组、辅助操作组合为紧凑第一行。
- `src/components/SearchFilters.tsx`：保留搜索输入，把筛选按钮迁移到紧凑筛选组，并把视图切换按钮放入搜索行右侧。
- `src/components/Icon.tsx`：新增筛选、语言、列表、分组、折叠/展开、勾选所需 SVG 图标。
- `src/i18n/i18n.ts`：补充 tooltip、短标签、语言菜单和图标按钮无障碍文案。
- `src/styles.css`：实现两行布局、32px 图标按钮、选中项文字展开、窄面板压缩、语言菜单、常驻搜索行和新的滚动高度。
- `src/App.test.tsx`：补充筛选、视图、搜索状态和滚动回归测试。
- `src/App.i18n.test.tsx`：补充双语文案、ARIA/title、精确 CSS 结构契约和语言菜单测试。
- `src/hooks/useStickySearchProgress.test.tsx`：如滚动距离或焦点暂停契约发生变化，更新 hook 的边界测试。
- `README.md`：更新工具栏紧凑布局和常驻搜索行说明（若现有说明需要同步）。

### 可能新增

- `src/components/LanguageMenu.tsx`：当 `App.tsx` 中语言菜单逻辑超过单一组件职责时，抽取为受控语言菜单组件。
- `src/components/CompactFilterGroup.tsx`：当筛选组 JSX/键盘可访问性逻辑需要独立测试时，抽取为筛选按钮组件。

不新增生产依赖、扩展权限、远程资源或图片图标资源。

---

## Task 1: 先建立新的组件行为契约（TDD RED）

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`
- Modify: `src/components/Icon.tsx`（仅在测试需要类型名且当前类型无法表达时，先补最小类型契约）

- [ ] **Step 1: 为筛选组新增失败测试**

在 `src/App.test.tsx` 增加测试，使用现有 fixture 和 render helper，验证：

```tsx
it('renders compact filter icons with only the active filter label visible', async () => {
  renderApp()

  const filterGroup = screen.getByRole('group', { name: /tab filters|标签筛选/i })
  const allButton = within(filterGroup).getByRole('button', { name: /all|全部/i })
  const currentWindowButton = within(filterGroup).getByRole('button', { name: /current window|当前窗口/i })
  const activeButton = within(filterGroup).getByRole('button', { name: /active tabs|活动标签/i })

  expect(allButton).toHaveAttribute('aria-pressed', 'true')
  expect(allButton).toHaveAttribute('title')
  expect(currentWindowButton).toHaveAttribute('title')
  expect(activeButton).toHaveAttribute('title')
  expect(allButton.textContent).toMatch(/all|全部/i)
  expect(currentWindowButton.textContent).not.toMatch(/current window|当前窗口/i)
  expect(activeButton.textContent).not.toMatch(/active tabs|活动标签/i)
})
```

- [ ] **Step 2: 为搜索行视图按钮新增失败测试**

```tsx
it('keeps list and domain view controls beside the search input', async () => {
  renderApp()

  const search = screen.getByRole('search')
  expect(within(search).getByRole('button', { name: /list view|列表视图/i })).toHaveAttribute('aria-pressed', 'true')
  expect(within(search).getByRole('button', { name: /domain view|分组视图/i })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(within(search).getByRole('button', { name: /domain view|分组视图/i }))
  expect(within(search).getByRole('button', { name: /domain view|分组视图/i })).toHaveAttribute('aria-pressed', 'true')
})
```

- [ ] **Step 3: 为语言菜单新增失败测试**

```tsx
it('opens the language menu from the globe button and returns focus on Escape', async () => {
  const user = userEvent.setup()
  renderApp()

  const globe = screen.getByRole('button', { name: /display language|显示语言/i })
  await user.click(globe)

  const menu = screen.getByRole('menu')
  expect(menu).toBeVisible()
  expect(within(menu).getByRole('menuitemradio', { name: /english|英文/i })).toBeChecked()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(globe).toHaveFocus()
})
```

- [ ] **Step 4: 为图标化折叠按钮新增失败测试**

```tsx
it('uses an icon-only control for collapsing all domain groups', async () => {
  const user = userEvent.setup()
  renderApp({ preferences: { viewMode: 'domain' } })

  const collapse = screen.getByRole('button', { name: /collapse all groups|折叠所有分组/i })
  expect(collapse).toHaveAttribute('title')
  expect(collapse.textContent).toBe('')

  await user.click(collapse)
  expect(screen.getByRole('button', { name: /expand all groups|展开所有分组/i })).toBeInTheDocument()
})
```

- [ ] **Step 5: 为吸顶搜索行新增失败测试**

测试在向下滚动并 flush rAF 后，第一行拥有 compact 语义，而搜索 input、列表和分组按钮仍存在且可见/可用；同时验证现有搜索值和视图值不被重置。

- [ ] **Step 6: 运行聚焦测试确认按预期失败**

Run:

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx
```

Expected: 新增契约测试失败，原因是当前筛选仍为文字 chips、语言仍为 `<select>`、视图仍在第一行、折叠按钮仍有文字，且搜索行尚未包含视图按钮。

---

## Task 2: 扩展 Icon 组件并实现图标按钮最小行为（TDD GREEN）

**Files:**
- Modify: `src/components/Icon.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/SearchFilters.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 扩展 `IconName` 和 SVG path map**

新增并保持内联 SVG：

```ts
type IconName =
  | 'all-tabs'
  | 'window'
  | 'active-tab'
  | 'globe'
  | 'list'
  | 'group'
  | 'collapse-all'
  | 'expand-all'
  | 'check'
  // 保留现有名称
```

所有 path 使用既有 24×24、`currentColor`、2px stroke 规范。

- [ ] **Step 2: 将第一行筛选改为紧凑按钮组**

在 `Header` 或独立 `CompactFilterGroup` 中接收 `filter`、`onFilterChange` 和 `t`，按钮结构保持：

```tsx
<div role="group" aria-label={t('tabFilters')} className="compact-filter-group">
  {filters.map((option) => (
    <button
      key={option.value}
      type="button"
      className={`compact-filter-button${filter === option.value ? ' is-active' : ''}`}
      aria-label={option.label}
      aria-pressed={filter === option.value}
      title={option.label}
      onClick={() => onFilterChange(option.value)}
    >
      <Icon name={option.icon} />
      {filter === option.value ? <span>{option.label}</span> : null}
    </button>
  ))}
</div>
```

- [ ] **Step 3: 将视图切换移入搜索行**

`SearchFilters` 保持搜索 input 的 DOM 位置和受控 value，改为：

```tsx
<section className="search-filters" aria-label={t('searchAndFilter')}>
  <div className="search-row">
    <div className="search-box" role="search">...</div>
    <div role="group" aria-label={t('viewMode')} className="view-mode-switch">
      <button type="button" aria-label={t('listView')} title={t('listView')} aria-pressed={viewMode === 'list'}>
        <Icon name="list" />
      </button>
      <button type="button" aria-label={t('domainView')} title={t('domainView')} aria-pressed={viewMode === 'domain'}>
        <Icon name="group" />
      </button>
    </div>
  </div>
</section>
```

将 `viewMode`、`onViewModeChange` 从 `App` 传入；不要通过重新挂载 input 实现布局移动。

- [ ] **Step 4: 将全局操作改为图标按钮**

保留全局脱敏业务逻辑，统一使用 `icon-button compact-icon-button`，并补 `title`。

将折叠按钮的内容改为 `Icon name="collapse-all"` 或 `Icon name="expand-all"`，保留本地化 `aria-label`、`title` 和原有 handler。

- [ ] **Step 5: 运行聚焦测试确认绿色**

Run:

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx
```

Expected: 新增图标、筛选、视图和折叠交互测试通过；语言菜单测试仍失败，待 Task 3 实现。

---

## Task 3: 实现语言弹出菜单和焦点管理（TDD）

**Files:**
- Create if needed: `src/components/LanguageMenu.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/i18n.ts`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`

- [ ] **Step 1: 细化语言菜单失败测试**

覆盖：

- 点击地球按钮打开菜单。
- 当前选项具有 `menuitemradio` 语义和 checked 状态。
- 点击中文/English/Auto 更新语言。
- `Escape` 关闭并将焦点返回按钮。
- `ArrowDown`/`ArrowUp` 在菜单项间移动。
- 点击菜单外关闭。
- 菜单打开或菜单焦点存在时滚动不会把第一行隐藏。

- [ ] **Step 2: 运行测试确认新增边界失败**

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx -t "language"
```

Expected: 失败在菜单不存在或焦点/键盘行为未实现。

- [ ] **Step 3: 实现最小受控菜单**

菜单组件接口建议：

```ts
interface LanguageMenuProps {
  value: UiLanguagePreference
  onChange: (value: UiLanguagePreference) => void
  t: Translator
  onOpenChange?: (open: boolean) => void
}
```

使用 button ref、菜单 ref、菜单项 refs；通过 `useEffect` 注册 document `pointerdown`/`mousedown` 外部点击处理，并在卸载时清理。菜单选项使用固定数组 `auto`, `zh-CN`, `en`，可访问语义优先于视觉实现。

- [ ] **Step 4: 将菜单开关接入滚动暂停**

`App` 的 sticky hook pause 条件扩展为：

```ts
paused={auxiliaryControlsFocused || languageMenuOpen}
```

确保菜单打开或菜单焦点期间第一行保持展开，关闭后根据最新滚动位置恢复。

- [ ] **Step 5: 添加菜单 CSS**

菜单必须：

- 使用绝对定位并锚定在第一行操作区域。
- 右侧对齐且不引起页面横向滚动。
- 每项至少 32px 高。
- 有清晰 focus-visible 样式和选中标记。
- 在 compact 隐藏状态下与 auxiliary 一起隐藏。

- [ ] **Step 6: 运行语言聚焦测试确认绿色**

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx -t "language|语言"
```

Expected: 语言菜单全部行为通过，中英文文案均通过。

---

## Task 4: 重排 CSS 为两行紧凑布局并保留搜索行吸顶

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`
- Modify: `src/hooks/useStickySearchProgress.test.tsx` if distance contract changes

- [ ] **Step 1: 新增精确 CSS 契约测试（先 RED）**

使用现有 `css-tree` helper，精确断言：

- `.toolbar-summary` 使用单行 `display:flex` 或等价不换行布局。
- `.tab-count` 有 `min-width:0`, `overflow:hidden`, `text-overflow:ellipsis`, `white-space:nowrap`。
- `.compact-filter-button` 固定 32px，选中态可显示文字，未选中态不依赖 CSS 隐藏可见文字。
- `.search-row` 为 flex；`.search-box` `flex:1` / `min-width:0`。
- `.view-mode-switch button` 为 32px。
- `.search-filters` 不属于 `toolbar-auxiliary`，且在 compact 语义下仍可见。
- 420px media 不把 `.toolbar-summary` 变成多行。
- 菜单定位、横向 overflow 和 reduced-motion 规则存在。

- [ ] **Step 2: 运行 CSS 聚焦测试确认失败**

```bash
npx vitest run src/App.i18n.test.tsx -t "compact|toolbar|search row|responsive"
```

Expected: 旧 CSS 契约与新布局断言不匹配。

- [ ] **Step 3: 实现两行布局 CSS**

关键规则：

```css
.toolbar-summary {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.compact-filter-group,
.toolbar-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.compact-filter-button,
.compact-icon-button,
.view-mode-switch button {
  inline-size: 32px;
  min-inline-size: 32px;
  block-size: 32px;
  min-block-size: 32px;
}

.compact-filter-button {
  display: inline-flex;
  max-inline-size: min(34vw, 132px);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  gap: 4px;
  padding-inline: 7px;
  white-space: nowrap;
}

.search-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.search-row .search-box {
  flex: 1 1 auto;
  min-width: 0;
}

.search-filters {
  min-width: 0;
  margin-top: calc(8px * (1 - var(--sticky-search-progress)));
}
```

将现有 `.filter-chips` 三行布局规则删除或替换；不要给搜索行添加 `toolbar-auxiliary` 或 `aria-hidden`。

- [ ] **Step 4: 调整滚动距离与折叠高度**

将 `useStickySearchProgress` 的 `distance` 从 112px 改为与第一行新高度匹配的值（实现初始使用 64px），并通过测试覆盖 0→distance→0 反向往返。搜索行不随 compact 隐藏。

- [ ] **Step 5: 完善窄宽度与 reduced-motion CSS**

在 `max-width:420px` 和 `max-width:340px` 下继续保持第一行 `flex-wrap:nowrap`，缩小计数和选中标签最大宽度，不修改核心图标按钮尺寸。Reduced Motion 只切换第一行展开/compact 语义，搜索行始终可见。

- [ ] **Step 6: 运行 CSS 与滚动测试确认绿色**

```bash
npx vitest run src/App.i18n.test.tsx src/hooks/useStickySearchProgress.test.tsx
```

Expected: CSS AST、滚动往返、焦点暂停和 420px 契约全部通过。

---

## Task 5: 国际化、状态保留与回归测试

**Files:**
- Modify: `src/i18n/i18n.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: 补充中英文翻译键**

为新增 UI 补充成对翻译，包括：

- 筛选组和三个筛选项 tooltip。
- 显示语言按钮和菜单。
- 列表视图、分组视图及其组名称。
- 折叠所有分组、展开所有分组。
- 语言菜单选中状态辅助文案（如需要）。

所有生产 UI 文案通过 `t(...)` 获取，不能添加硬编码中文或英文。

- [ ] **Step 2: 覆盖自动语言与手动语言**

验证浏览器语言为中文时 UI 使用中文；浏览器语言为不支持语言时使用英文；手动选择中文/English 后按钮 tooltip、菜单、筛选文字和视图名称同步更新。

- [ ] **Step 3: 覆盖状态保持**

在滚动往返前后验证以下状态不变：

- query
- filter
- viewMode
- collapsed domain group
- globalMasked
- per-tab mask override
- manual language
- loading/error/pending operation

- [ ] **Step 4: 更新 README**

补充工具栏行为：第一行是紧凑辅助控件，第二行搜索和视图切换持续吸顶，语言通过地球按钮菜单切换。

- [ ] **Step 5: 运行完整测试**

```bash
npm test
```

Expected: 所有测试文件通过，测试数量不低于当前基线，并包含新布局、语言菜单和滚动回归测试。

---

## Task 6: 规格复审、代码质量复审与最终验证

**Files:**
- All changed files from Tasks 1–5

- [ ] **Step 1: 实现代理完成后做工作区检查**

检查：

```bash
find src -maxdepth 3 -type f | sort
rg -n "language-select|filter-chips|view-mode-switch|toolbar-auxiliary|search-row|LanguageMenu" src
```

确认没有旧 `<select>`、旧文字筛选 chip 或第一行视图切换残留。

- [ ] **Step 2: 派发独立规格审查代理**

审查范围：逐条对照设计规格，重点检查：

- 两行布局和吸顶搜索行。
- 选中筛选文字/未选中图标。
- 语言菜单完整键盘和外部点击行为。
- 窄宽度不换行与压缩顺序。
- 国际化、ARIA、tooltip、Reduced Motion。
- 现有 Tab 管理业务和状态未回归。

要求代理明确回复“规格审查通过”，否则让实现代理修复后重审。

- [ ] **Step 3: 派发独立代码质量审查代理**

重点检查：

- 语言菜单事件监听和焦点管理 cleanup。
- React key/ref/state 设计是否导致搜索 input 重建。
- CSS 选择器、overflow、z-index 和窄宽度下的横向溢出。
- 滚动 rAF 是否仍避免逐帧 App rerender。
- 测试是否真实覆盖行为而不是只断言实现细节。
- 是否有重复逻辑、死 CSS、硬编码文案或不必要依赖。

要求代理明确回复“代码质量审查通过”，否则修复后重审。

- [ ] **Step 4: 主控运行最终验证**

```bash
npm test
npm run lint
npm run build
```

`npm run build` 必须完成 TypeScript、Vite 构建和 `build/validateDist.ts` dist 安全校验。

- [ ] **Step 5: 检查最终产物**

```bash
find dist -maxdepth 3 -type f -print | sort
cat dist/manifest.json
```

确认包含 `index.html`、`background.js`、`manifest.json`、图标、双语 `_locales` 和构建后的 assets；权限仍只有现有 `tabs`、`favicon`、`sidePanel`。

- [ ] **Step 6: 交付**

最终用中文汇报：

- 第一行和第二行具体变化。
- 语言菜单和键盘行为。
- 滚动吸顶与性能处理。
- 自动化测试数量、Lint、Build 结果。
- Chrome 加载目录：
  `<项目目录>/dist`

当前工作区不是 Git 仓库，因此不执行 commit；以工作区文件和最终构建产物作为交付结果。
