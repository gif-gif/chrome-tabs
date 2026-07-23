# Smaller Action Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工具栏图标按钮统一缩小，并将标签及分组眼睛/关闭按钮改成更小的无背景操作。

**Architecture:** 继续复用现有 `Icon` 组件，通过调用处的 `width/height` 与作用域 CSS 变量区分工具栏和列表操作尺寸。使用专用 action class 限定无背景行为，避免影响搜索清除、抽屉关闭等其他按钮。

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, css-tree

---

### Task 1: 建立尺寸与无背景 CSS 契约

**Files:**
- Modify: `src/App.i18n.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] 先增加失败测试，精确断言工具栏控制尺寸 28px、工具栏 SVG 16px、列表/分组 action 尺寸 26px、SVG 15px。
- [ ] 使用 css-tree 精确断言列表/分组操作的默认、hover、active、focus-visible 背景为 transparent/none，且 focus-visible 有 outline。
- [ ] 行为测试确认眼睛和关闭按钮的 ARIA、disabled/pending 与点击行为不变。
- [ ] 运行 `npx vitest run src/App.test.tsx src/App.i18n.test.tsx`，确认新增测试因旧尺寸和背景失败。

### Task 2: 小型化工具栏

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/SearchFilters.tsx`
- Modify: `src/components/LanguageMenu.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] 将工具栏 `Icon` 调用明确设为 `width={16}`、`height={16}`，或用等价作用域 CSS 保证 SVG 为 16px。
- [ ] 将 `--compact-control-size` 从 32px 调为 28px。
- [ ] 同步调整第一行 `--toolbar-summary-expanded-height`、间距、选中筛选 padding 和语言菜单锚点，避免裁切或横向溢出。
- [ ] 保持搜索 input DOM、语言菜单键盘行为、滚动 compact 和 tooltip/ARIA 不变。
- [ ] 运行聚焦测试确认通过。

### Task 3: 小型化标签与分组操作并去背景

**Files:**
- Modify: `src/components/TabRow.tsx`
- Modify: `src/components/DomainGroup.tsx`
- Modify: `src/components/WindowGroup.tsx`（若包含对应眼睛/关闭操作）
- Modify: `src/styles.css`

- [ ] 为标签及分组眼睛/关闭按钮添加统一专用 class，例如 `row-action-button`，避免改写所有 `.icon-button`。
- [ ] 对相关 `Icon` 明确使用 15px。
- [ ] 设置按钮为 26×26px，默认 background transparent，hover/active/focus-visible 不填充背景。
- [ ] 眼睛 hover/focus 仅改变颜色；关闭 hover/focus 仅变危险红色。
- [ ] 使用 outline 提供键盘 focus-visible 状态。
- [ ] 保留 disabled、pending、事件 stopPropagation 和确认逻辑。

### Task 4: 回归与双阶段复审

**Files:**
- All changed files

- [ ] 运行聚焦测试并修复回归。
- [ ] 派发独立规格审查，要求明确“规格审查通过”。
- [ ] 派发独立代码质量审查，重点检查按钮作用域、点击目标、焦点可见性、死 CSS 与选择器污染，要求明确“代码质量审查通过”。
- [ ] 主控运行 `npm test && npm run lint && npm run build`。
- [ ] 检查 `dist` 和 manifest 权限不变，交付 `<项目目录>/dist`。
