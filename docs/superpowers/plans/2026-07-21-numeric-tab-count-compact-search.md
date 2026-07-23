# Numeric Tab Count and Compact Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工具栏标签计数改为纯数字，并将搜索框高度压缩到 36px。

**Architecture:** `Header` 继续接收数值 count，但仅渲染数字文本，完整本地化计数只用于 title 和 aria-label。搜索框仅通过精确 CSS 调整高度/间距，不重构输入组件或滚动状态。

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, css-tree

---

### Task 1: TDD RED

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`

- [ ] 增加中英文行为测试：计数可见文本只为数字，元素 `title` 和 `aria-label` 为完整本地化计数。
- [ ] 增加 CSS AST 测试：`.search-box` height 为 `36px`；`.tab-count` 为内容宽度且窄屏 media 不再裁切计数。
- [ ] 运行 `npx vitest run src/App.test.tsx src/App.i18n.test.tsx`，确认测试因旧完整计数文字和 40px 高度失败。

### Task 2: 最小实现

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/styles.css`

- [ ] 在 Header 中计算完整本地化标签 `const countLabel = t('tabCount', { count })`。
- [ ] `.tab-count` 可见内容渲染 `{count}`，并设置 `title={countLabel}`、`aria-label={countLabel}`。
- [ ] 将计数布局改为 `flex: 0 0 auto`，移除不再需要的 overflow/ellipsis 和窄屏压缩规则。
- [ ] 将 `.search-box` height 改为 `36px`，微调 padding/列宽时保持清除按钮与输入可用。
- [ ] 不改变翻译、搜索组件 DOM、视图按钮和 sticky hook。
- [ ] 运行聚焦测试确认绿色。

### Task 3: 双阶段复审与验证

- [ ] 独立规格审查：核验纯数字显示、完整辅助语义、36px 搜索框和窄宽度。
- [ ] 独立代码质量审查：核验 ARIA 命名、CSS cascade、输入稳定性、无死响应式规则。
- [ ] 主控运行 `npm test && npm run lint && npm run build`。
- [ ] 检查 dist 与 manifest 权限，交付 `<项目目录>/dist`。
