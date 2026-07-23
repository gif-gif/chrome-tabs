# Search Sticky Scroll Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Side Panel 向下滚动时搜索框平滑吸顶、其他工具控件淡出收起，向上滚动时按滚动位置平滑恢复。

**Architecture:** 新增一个独立 hook 从 Side Panel 滚动容器计算 `0–1` 的动画进度，并通过 `requestAnimationFrame` 合并 scroll 更新。App 将进度作为 CSS 自定义属性传给 sticky 工具栏；CSS 负责辅助工具区的淡出、位移和高度收起，以及搜索框吸顶视觉过渡。焦点保护保证键盘用户不会失去当前控件，减少动态效果模式使用近乎即时切换。

**Tech Stack:** React 19, TypeScript, CSS custom properties, requestAnimationFrame, Vitest, Testing Library。

---

### Task 1: 滚动进度 Hook

**Files:**
- Create: `src/hooks/useStickySearchProgress.ts`
- Create: `src/hooks/useStickySearchProgress.test.tsx`

- [ ] 写失败测试，使用可控滚动容器、mock `requestAnimationFrame` 和 `cancelAnimationFrame`，覆盖顶部、中间、超过阈值、反向滚动、帧合并和卸载清理。
- [ ] 运行 `npm test -- src/hooks/useStickySearchProgress.test.tsx`，确认因 hook 不存在或行为未实现而 RED。
- [ ] 实现 `useStickySearchProgress(ref, { distance, paused })`：读取 `scrollTop`，限制进度到 `0–1`，通过单个待处理 frame 合并更新；`paused` 时向 UI 返回 `0`，但保留最新滚动位置以便恢复。
- [ ] 再运行目标测试，确认 GREEN。

### Task 2: 工具栏结构、滚动容器和焦点保护

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`
- Modify: `src/components/Header.tsx` only if semantic grouping needs adjustment
- Modify: `src/components/SearchFilters.tsx` only if search and filter sections need separate wrappers

- [ ] 写失败测试：为实际滚动容器触发 scroll，断言搜索框始终存在；辅助区域在进度完成时带隐藏/不可交互状态；向上滚动后恢复。
- [ ] 写失败测试：先输入搜索内容、切换筛选/视图/语言和隐私状态，再滚动往返，断言这些状态不变。
- [ ] 写失败测试：让辅助工具按钮获得焦点后滚动，断言工具栏保持展开且该控件不被 `aria-hidden`；焦点离开后按当前滚动位置收起。
- [ ] 运行 `npm test -- src/App.test.tsx src/App.i18n.test.tsx`，确认新增场景 RED。
- [ ] 在 App 中为滚动容器添加 ref，调用 hook，并用 `focusin`/`focusout` 或 React focus capture 判断辅助区域内是否持有焦点。
- [ ] 将 sticky 工具栏划分为搜索框和两个辅助区域；保持所有现有控件、事件和 aria-label 不变。
- [ ] 设置 `--sticky-search-progress`、`data-compact`、辅助区域 `aria-hidden` 和 pointer-event 控制；避免搜索框重新挂载。
- [ ] 再运行 App 目标测试，确认 GREEN。

### Task 3: 渐进动画和减少动态效果

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify: `src/App.i18n.test.tsx`

- [ ] 先添加 CSS 回归测试，要求存在 `--sticky-search-progress`、辅助区域 opacity/transform/max-height 规则、搜索框吸顶视觉过渡、`prefers-reduced-motion` 和原有 `420px` 响应式规则。
- [ ] 运行目标测试，确认 CSS 规则缺失而 RED。
- [ ] 实现滚动进度驱动样式：辅助区域淡出、上移、收起；搜索框圆角、边框、阴影和 sticky 背景平滑变化。
- [ ] 为完全隐藏状态禁用 pointer events；减少动态效果模式取消明显位移和动画，仅保留功能性的即时收起/展开。
- [ ] 检查 280px、320px、360px、400px 和常规宽度下不产生横向滚动。
- [ ] 再运行目标测试，确认 GREEN。

### Task 4: 文档和完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-21-search-sticky-scroll-animation-design.md` only if implementation resolves an ambiguity

- [ ] 更新 README 的固定工具区说明：滚动时只保留搜索框吸顶，其他控件渐进淡出并在回到顶部时恢复。
- [ ] 扫描生产代码，确认没有新增未国际化的用户可见文案。
- [ ] 运行 `npm test`，要求所有测试通过。
- [ ] 运行 `npm run lint`，要求退出码为 0。
- [ ] 运行 `npm run build`，要求 TypeScript、Vite 和最终 dist 校验全部通过。
- [ ] 进行独立规格符合性审查，修复所有发现后重新审查。
- [ ] 进行独立代码质量审查，重点检查 scroll listener、animation frame 清理、焦点处理和布局性能；修复所有发现后重新审查。
