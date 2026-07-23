# Chrome Tabs 中英文国际化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Side Panel 和 Chrome 扩展元数据提供完整中英文国际化，默认跟随浏览器语言、未知语言回退英文，并允许持久化手动选择。

**Architecture:** 使用本地类型安全字典和纯语言解析函数，不引入运行时 i18n 依赖。App 解析语言偏好并把翻译器传给组件、领域展示函数和 hook 错误文案；Manifest 使用 Chrome 标准 `_locales`。偏好解析兼容旧数据，缺少语言字段时迁移为 `auto`。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Chrome MV3 i18n manifest resources。

---

### Task 1: 类型安全字典与语言解析

**Files:**
- Create: `src/i18n/i18n.ts`
- Create: `src/i18n/i18n.test.ts`
- Modify: `src/types.ts`

- [ ] 先写失败测试，覆盖 `zh-CN`/`zh-TW`/`zh-HK`、`en-*`、语言顺序、未知语言、空列表、手动覆盖和变量插值。
- [ ] 运行 `npm test -- src/i18n/i18n.test.ts`，确认因模块不存在而 RED。
- [ ] 实现 `UiLanguagePreference`、`SupportedLocale`、类型安全中英文字典、`resolveLocale`、`createTranslator`。
- [ ] 再运行目标测试确认 GREEN。

### Task 2: 偏好持久化与旧数据迁移

**Files:**
- Modify: `src/preferences/uiPreferences.ts`
- Modify: `src/preferences/uiPreferences.test.ts`
- Modify: `src/types.ts`

- [ ] 先写失败测试：默认 `language:auto`；旧合法 v1 对象缺少语言时保留隐私/视图并迁移为 auto；合法三种值恢复；非法语言仅回退 auto；保存包含 language。
- [ ] 运行目标测试确认 RED。
- [ ] 最小实现兼容解析和保存。
- [ ] 再运行目标测试确认 GREEN。

### Task 3: 领域展示文字与 hook 错误国际化

**Files:**
- Modify: `src/domain/tabs.ts`
- Modify: `src/domain/tabs.test.ts`
- Modify: `src/hooks/useChromeTabs.ts`
- Modify: `src/hooks/useChromeTabs.test.tsx`

- [ ] 先写失败测试，覆盖英文的隐藏占位、当前窗口、窗口编号、网站分组、其他页面，以及英文查询/订阅错误。
- [ ] 运行目标测试确认 RED。
- [ ] 让领域展示函数接收翻译器/展示文案；让 hook 接收本地化错误文案或稳定错误映射，语言变化不泄露原始错误。
- [ ] 再运行目标测试确认 GREEN。

### Task 4: 全部 React UI 与语言选择器

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/SearchFilters.tsx`
- Modify: `src/components/StatusView.tsx`
- Modify: `src/components/WindowGroup.tsx`
- Modify: `src/components/DomainGroup.tsx`
- Modify: `src/components/TabRow.tsx`
- Modify: `src/components/DrawerToggle.tsx`
- Modify: `src/styles.css`

- [ ] 先写失败 App 测试：中文浏览器自动中文、英文浏览器英文、法语回退英文、手动中文/English/Auto、偏好恢复、`html lang`、列表/分组/搜索/筛选/隐私/确认/错误文案。
- [ ] 添加位置与可访问性测试：语言选择器在 sticky toolbar，始终可见，有本地化 label，窄布局不破坏现有按钮。
- [ ] 运行 `npm test -- src/App.test.tsx` 确认 RED。
- [ ] App 创建翻译器、保存语言偏好并传给所有组件；所有硬编码中文 UI 字符串替换为翻译 key；切换不重置现有状态。
- [ ] 更新 CSS 适配紧凑选择器与窄面板。
- [ ] 再运行 App 测试确认 GREEN。

### Task 5: Chrome Manifest `_locales`

**Files:**
- Modify: `public/manifest.json`
- Create: `public/_locales/en/messages.json`
- Create: `public/_locales/zh_CN/messages.json`
- Modify: `src/manifest.test.ts`
- Modify: `build/validateDist.ts` if existing validation needs locale awareness

- [ ] 先写失败测试：`default_locale=en`；manifest 三个文本字段为 `__MSG_*__`；两份 messages key 完全一致且中文/英文非空。
- [ ] 运行 `npm test -- src/manifest.test.ts` 确认 RED。
- [ ] 添加标准 Chrome locale 资源并更新 manifest；确保 build 复制 `_locales`。
- [ ] 再运行 manifest 测试确认 GREEN。

### Task 6: 文档、完整验证与审查

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-21-chrome-tabs-i18n-design.md` only if implementation clarifies an ambiguity

- [ ] 更新 README：支持语言、自动解析、未知语言回退、手动切换、Chrome 元数据国际化。
- [ ] 扫描生产源码中残留用户可见硬编码中文；允许 locale 字典、README 和内部不可见错误常量。
- [ ] 运行 `npm test`。
- [ ] 运行 `npm run lint`。
- [ ] 运行 `npm run build` 并验证 `dist/_locales/en/messages.json`、`dist/_locales/zh_CN/messages.json`。
- [ ] 独立规格审查和代码质量审查，修复所有 Critical/Important/Minor 问题后复验。
