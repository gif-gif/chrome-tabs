# Segmented Filter Pill Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Side Panel 第一行改为独立浅蓝数量胶囊、始终显示短文案的浅灰分段筛选胶囊，并让其他工具按钮靠右排列。

**Architecture:** `Header` 将每个筛选项拆成可见短标签和完整辅助标签：短标签始终渲染，完整标签用于 `title` 与 `aria-label`。CSS 继续复用现有主题变量，通过数量胶囊、筛选组外层胶囊、选中白色分段和 `margin-left: auto` 操作区建立视觉层级；极窄宽度仅隐藏装饰性筛选图标，保留短文字和功能。

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, css-tree, Vite, Chrome MV3

---

## 文件映射

- `src/i18n/i18n.ts`：增加筛选短标签与“全部标签页”的完整辅助文案，保留现有完整窗口/活动文案供其它 UI 使用。
- `src/components/Header.tsx`：始终渲染三个筛选短标签，并将完整文案用于按钮 `title`/`aria-label`。
- `src/styles.css`：实现数量胶囊、统一分段筛选胶囊、选中状态、右侧操作对齐及极窄宽度降级。
- `src/App.test.tsx`：验证中文 DOM、筛选行为与完整辅助文案。
- `src/App.i18n.test.tsx`：验证英文 DOM、国际化切换和 CSS AST 视觉契约。
- `src/i18n/i18n.test.ts`：验证新增短文案/完整文案翻译键及类型契约。
- `public/manifest.json`：只检查，不修改；权限必须保持 `tabs`、`favicon`、`sidePanel`。

### Task 1: TDD RED — 筛选短文案与完整辅助文案

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`
- Modify: `src/i18n/i18n.test.ts`

- [ ] **Step 1: 添加中文 Header 行为测试**

在 `src/App.test.tsx` 的 `describe('Header')` 中修改/补充测试，使 `filter="all"` 时三个按钮都包含可见短文案，同时辅助名称保持完整：

```tsx
const allButton = screen.getByRole('button', { name: '全部标签页' })
const currentButton = screen.getByRole('button', { name: '当前窗口' })
const activeButton = screen.getByRole('button', { name: '活动标签' })

expect(allButton).toHaveTextContent('全部')
expect(currentButton).toHaveTextContent('当前')
expect(activeButton).toHaveTextContent('活动')
expect(allButton).toHaveAttribute('title', '全部标签页')
expect(currentButton).toHaveAttribute('title', '当前窗口')
expect(activeButton).toHaveAttribute('title', '活动标签')
expect(allButton).toHaveAttribute('aria-pressed', 'true')
expect(currentButton).toHaveAttribute('aria-pressed', 'false')
expect(activeButton).toHaveAttribute('aria-pressed', 'false')
```

继续使用现有点击测试验证 `onFilterChange` 分别收到 `all`、`current-window`、`active`，不要改变筛选业务行为。

- [ ] **Step 2: 添加英文 Header 行为测试**

在 `src/App.i18n.test.tsx` 中渲染英文 `Header`，验证三个按钮始终显示短文案且完整名称不缩短：

```tsx
const allButton = screen.getByRole('button', { name: 'All tabs' })
const currentButton = screen.getByRole('button', { name: 'Current window' })
const activeButton = screen.getByRole('button', { name: 'Active tabs' })

expect(allButton).toHaveTextContent('All')
expect(currentButton).toHaveTextContent('Current')
expect(activeButton).toHaveTextContent('Active')
expect(allButton).toHaveAttribute('title', 'All tabs')
expect(currentButton).toHaveAttribute('title', 'Current window')
expect(activeButton).toHaveAttribute('title', 'Active tabs')
```

- [ ] **Step 3: 添加翻译键测试和类型契约**

在 `src/i18n/i18n.test.ts` 的 `assertTranslatorTypeContract` 中调用新增静态键，并在翻译测试中加入：

```ts
expect(zh('allTabs')).toBe('全部标签页')
expect(zh('allShort')).toBe('全部')
expect(zh('currentWindowShort')).toBe('当前')
expect(zh('activeTabsShort')).toBe('活动')
expect(en('allTabs')).toBe('All tabs')
expect(en('allShort')).toBe('All')
expect(en('currentWindowShort')).toBe('Current')
expect(en('activeTabsShort')).toBe('Active')
```

- [ ] **Step 4: 运行聚焦测试确认 RED**

Run:

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx src/i18n/i18n.test.ts
```

Expected: FAIL。失败原因应包括新增翻译键不存在、未选中的筛选按钮没有可见文字，以及“全部”按钮仍以短文案作为辅助名称。

### Task 2: TDD RED — 胶囊样式与窄宽度 CSS 契约

**Files:**
- Modify: `src/App.i18n.test.tsx`

- [ ] **Step 1: 添加数量胶囊 CSS AST 断言**

在现有 `compact progressive sticky toolbar CSS contract` 中使用 `declarationsFor` 验证：

```ts
const count = declarationsFor('.tab-count')
expect(count.get('display')).toBe('inline-grid')
expect(count.get('min-width')).toBe('28px')
expect(count.get('height')).toBe('24px')
expect(count.get('padding')).toBe('0 8px')
expect(count.get('color')).toBe('var(--color-accent)')
expect(count.get('background')).toBe('var(--color-accent-soft)')
expect(count.get('border-radius')).toBe('999px')
expect(count.get('font-variant-numeric')).toBe('tabular-nums')
```

并验证 `.compact-filter-group` 使用 `margin-left: 10px` 与数量胶囊分隔。

- [ ] **Step 2: 添加分段筛选胶囊 CSS AST 断言**

增加以下精确契约：

```ts
const filters = declarationsFor('.compact-filter-group')
expect(filters.get('height')).toBe('30px')
expect(filters.get('padding')).toBe('2px')
expect(filters.get('gap')).toBe('2px')
expect(filters.get('background')).toBe('var(--color-hover)')
expect(filters.get('border-radius')).toBe('999px')

const filterButton = declarationsFor('.compact-filter-button')
expect(filterButton.get('height')).toBe('26px')
expect(filterButton.get('min-width')).toBe('0')
expect(filterButton.get('padding')).toBe('0 7px')
expect(filterButton.get('background')).toBe('transparent')
expect(filterButton.get('border-radius')).toBe('999px')

const selected = declarationsFor('.compact-filter-button.is-active')
expect(selected.get('color')).toBe('var(--color-accent)')
expect(selected.get('background')).toBe('var(--color-surface)')
expect(selected.get('box-shadow')).toBe('0 1px 2px rgb(60 64 67/18%)')
```

使用 css-tree 的标准化值作为预期；如 AST 输出空格不同，以 `generate()` 的实际规范化形式为准。

- [ ] **Step 3: 添加右侧对齐和极窄宽度契约**

验证操作区靠右，并在 `max-width: 340px` 中只隐藏筛选图标、保留文字：

```ts
expect(declarationsFor('.app-header-actions').get('margin-left')).toBe('auto')

const media340 = '(max-width:340px)'
expect(
  declarationsFor('.compact-filter-button>svg', media340).get('display'),
).toBe('none')
expect(
  declarationsFor('.compact-filter-label', media340).get('display'),
).not.toBe('none')
```

同时删除或更新旧的 `.compact-filter-button:not(.is-active)` 固定宽度、旧 `.compact-filter-label` 截断宽度和 `300px` 仅选中项压缩断言，避免测试继续固化旧交互。

- [ ] **Step 4: 再次运行聚焦测试确认 CSS RED**

Run:

```bash
npx vitest run src/App.i18n.test.tsx
```

Expected: FAIL。失败应来自当前 `.tab-count` 无胶囊背景、筛选组无外层背景、选中项仍为强调色软背景、操作区未靠右以及窄屏仍使用旧标签截断规则。

### Task 3: GREEN — 国际化与 Header 最小实现

**Files:**
- Modify: `src/i18n/i18n.ts`
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: 增加中英文短标签和完整“全部标签页”文案**

在 `messages['zh-CN']` 和 `messages.en` 中分别加入以下静态键，保持键集合完全一致：

```ts
// zh-CN
allTabs: '全部标签页',
allShort: '全部',
currentWindowShort: '当前',
activeTabsShort: '活动',

// en
allTabs: 'All tabs',
allShort: 'All',
currentWindowShort: 'Current',
activeTabsShort: 'Active',
```

保留现有 `all`、`currentWindowFilter`、`activeTabs` 键，避免影响其它调用者和已有完整文案。

- [ ] **Step 2: 将 Header 筛选定义拆成短标签和辅助标签**

在 `src/components/Header.tsx` 中将 `filters` 改为：

```tsx
const filters: Array<{
  value: TabFilter
  label: string
  accessibleLabel: string
}> = [
  { value: 'all', label: t('allShort'), accessibleLabel: t('allTabs') },
  {
    value: 'current-window',
    label: t('currentWindowShort'),
    accessibleLabel: t('currentWindowFilter'),
  },
  {
    value: 'active',
    label: t('activeTabsShort'),
    accessibleLabel: t('activeTabs'),
  },
]
```

- [ ] **Step 3: 始终渲染短标签并保留完整辅助名称**

将按钮属性和标签渲染改为：

```tsx
aria-label={option.accessibleLabel}
title={option.accessibleLabel}

<Icon name={filterIcons[option.value]} width={16} height={16} />
<span className="compact-filter-label">{option.label}</span>
```

移除 `selected ? ... : null` 条件，但继续保留 `aria-pressed={selected}`、`.is-active` 类和原有 `onClick`。

- [ ] **Step 4: 运行行为测试确认国际化与 DOM GREEN**

Run:

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx src/i18n/i18n.test.ts
```

Expected: 文案和 Header DOM 测试转绿；CSS AST 新测试仍可因样式未实现而失败。若需分离验证，使用 Vitest `-t` 只运行 Header/i18n 测试，并记录结果。

### Task 4: GREEN — 胶囊 CSS、右对齐与极窄降级

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 实现数量胶囊**

将 `.tab-count` 调整为：

```css
.tab-count {
  display: inline-grid;
  flex: 0 0 auto;
  min-width: 28px;
  height: 24px;
  margin: 0;
  padding: 0 8px;
  place-items: center;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
```

- [ ] **Step 2: 将筛选组改为统一浅灰外层胶囊**

从共享的 `.compact-filter-group, .app-header-actions, .view-mode-switch` 规则中拆出 `.compact-filter-group`，并应用：

```css
.compact-filter-group {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 30px;
  gap: 2px;
  margin-left: 10px;
  padding: 2px;
  background: var(--color-hover);
  border-radius: 999px;
}
```

让 `.app-header-actions, .view-mode-switch` 继续保持现有 inline-flex/gap 行为。

- [ ] **Step 3: 实现分段项常态和选中态**

将 `.compact-filter-button` 与 `.compact-icon-button` 的共享尺寸拆开，确保只改变筛选项，不改变右侧 28px 图标按钮：

```css
.compact-filter-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 0;
  height: 26px;
  gap: 4px;
  padding: 0 7px;
  color: var(--color-text-muted);
  background: transparent;
  border: 0;
  border-radius: 999px;
  transition: background-color var(--motion-fast) ease,
    color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease;
}

.compact-filter-button.is-active {
  color: var(--color-accent);
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgb(60 64 67 / 18%);
}
```

移除 `.compact-filter-button:not(.is-active)` 的固定 28px 宽度规则。将 `.view-mode-switch button[aria-pressed="true"]` 保持在独立规则中，继续使用现有 `--color-accent-soft`，避免搜索行视图按钮被改成白底分段样式。

- [ ] **Step 4: 保持标签始终可见并将其他操作靠右**

将 `.compact-filter-label` 保持为短文字且不裁切：

```css
.compact-filter-label {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.app-header-actions {
  position: relative;
  margin-left: auto;
}
```

保留 `.app-header-actions` 的现有 `position: relative`，以免语言菜单定位回归。

- [ ] **Step 5: 替换旧窄屏压缩规则**

删除当前 `420px`、`340px`、`300px` 中针对 `.compact-filter-label` 的 `max-width` 和 `.compact-filter-button.is-active` 的极窄 padding 规则，改为：

```css
@media (max-width: 340px) {
  .compact-filter-group {
    margin-left: 6px;
  }

  .compact-filter-button {
    gap: 0;
    padding-inline: 5px;
  }

  .compact-filter-button > svg {
    display: none;
  }
}
```

保持三个文字始终可见；不得隐藏右侧操作按钮或改变其 DOM。

- [ ] **Step 6: 运行聚焦测试确认全部 GREEN**

Run:

```bash
npx vitest run src/App.test.tsx src/App.i18n.test.tsx src/i18n/i18n.test.ts src/hooks/useStickySearchProgress.test.tsx
```

Expected: 4 个测试文件全部通过，Header 文案、筛选行为、CSS AST 与 sticky 搜索回归测试均绿色。

### Task 5: 双阶段审查与完整验证

**Files:**
- Inspect: `src/components/Header.tsx`
- Inspect: `src/styles.css`
- Inspect: `src/i18n/i18n.ts`
- Inspect: `src/App.test.tsx`
- Inspect: `src/App.i18n.test.tsx`
- Inspect: `src/i18n/i18n.test.ts`
- Inspect: `public/manifest.json`
- Inspect: `dist/manifest.json`

- [ ] **Step 1: 独立规格审查**

审查者逐项核对设计规格：数量浅蓝胶囊、10px 分区、统一浅灰筛选胶囊、白底蓝字选中态、中英文短标签、完整辅助名称、右侧操作靠右、深色主题变量、340px 下仅隐藏装饰图标。只有全部满足时输出精确短语：

```text
规格审查通过
```

- [ ] **Step 2: 独立代码质量审查**

审查者检查国际化键命名、React 映射结构、CSS selector/cascade、语言菜单定位、视图按钮样式隔离、窄宽度可用性、测试稳健性和无关改动。只有无阻塞或重要问题时输出精确短语：

```text
代码质量审查通过
```

- [ ] **Step 3: 主控运行完整自动化测试**

Run:

```bash
npm test
```

Expected: 11 个测试文件全部通过；测试数量为基线 309 加本计划新增测试后的实际总数。

- [ ] **Step 4: 主控运行 Lint**

Run:

```bash
npm run lint
```

Expected: exit code 0，无 ESLint 错误。

- [ ] **Step 5: 主控运行生产构建和 dist 校验**

Run:

```bash
npm run build
```

Expected: TypeScript、Vite 构建及 `build/validateDist.ts` 全部通过，并生成 `<项目目录>/dist`。

- [ ] **Step 6: 检查最终权限与构建样式**

Run:

```bash
node -e "const fs=require('fs'); for (const path of ['public/manifest.json','dist/manifest.json']) { const m=JSON.parse(fs.readFileSync(path,'utf8')); console.log(path, m.permissions, m.host_permissions) }"
```

Expected: 两份 manifest 权限均仅为 `tabs`、`favicon`、`sidePanel`，无 `host_permissions`。

检查生成 CSS 中存在数量胶囊、筛选胶囊、选中白底和 `app-header-actions` 右对齐规则；不要依赖哈希文件名，使用 `find dist/assets -name '*.css'` 获取实际文件。

- [ ] **Step 7: 交付**

最终中文回复列出：视觉变化、中英文文案、双审查结论、实际测试文件/测试数量、Lint/构建/权限结果，以及 Chrome 扩展重载路径：

```text
<项目目录>/dist
```

本工作区不是 Git 仓库，因此不执行 commit、branch 或 worktree 操作。
