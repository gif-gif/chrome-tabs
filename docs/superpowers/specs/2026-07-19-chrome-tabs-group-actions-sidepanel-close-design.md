# Chrome Tabs 分组操作与 Side Panel 关闭优化设计规格

- 日期：2026-07-19
- 状态：用户已确认
- 技术方向：React + TypeScript + Vite + Chrome Extension Manifest V3

## 1. 目标

在已有列表/域名分组、实时同步、隐私脱敏功能上增加三项交互：

1. 分组模式下直接隐藏当前分组内可见标签页。
2. 分组模式下通过二次确认关闭当前分组内可见标签页。
3. 分组模式下提供一键全部折叠/展开。
4. 抽屉箭头改为真正关闭 Chrome Side Panel，释放浏览器侧边栏空间；再次打开由 Chrome 工具栏扩展图标触发。

## 2. 分组操作范围

- 操作对象是经过当前搜索词和筛选条件后的 `DisplayDomainGroup.tabs`，只处理当前界面可见标签页。
- 隐藏分组不会关闭标签页，只为该分组内的可见标签写入单 Tab 脱敏覆盖；如果全局已隐藏，则操作保持幂等，不改变全局开关。
- 关闭分组需要二次确认。确认文案必须包含分组可见标签数量；取消不调用 Chrome 关闭 API。
- 关闭分组按当前分组可见标签逐个调用既有 `closeTab`，复用单标签关闭的 pending、防重复、错误提示和刷新机制；成功关闭后清理对应单 Tab 脱敏覆盖。
- 分组标题操作按钮不能触发分组折叠/展开；按钮均有动态无障碍标签。

## 3. 一键折叠/展开

- 仅在域名分组模式显示。
- 工具栏提供一个切换按钮：
  - 存在任何展开分组时显示“全部折叠”；
  - 全部分组均已折叠且存在分组时显示“全部展开”。
- “全部折叠”将当前可见分组 key 全部加入内存 Set；“全部展开”清除当前可见分组 key。
- 搜索/筛选结果变化不影响未显示分组的折叠状态；实时同步清理已不存在的分组 key。

## 4. Side Panel 关闭

- 抽屉按钮不再移动/隐藏 React 内容，也不持久化 `drawerCollapsed`。
- 点击按钮调用 `chrome.sidePanel.close({ windowId })`，由当前活动窗口确定 `windowId`。
- 若 Side Panel API 不可用或调用失败，显示安全的操作错误信息，不将底层异常文本渲染到 DOM。
- 为使用 `chrome.sidePanel.close`，`minimum_chrome_version` 更新为 `141`。
- Side Panel 关闭后不保留网页内箭头；用户点击 Chrome 工具栏中的扩展图标重新打开。

## 5. 偏好与兼容

- `UiPreferences` 移除 `drawerCollapsed`；读取旧版本对象时忽略该字段，其他偏好继续兼容。
- 保存对象只包含 `version`、`globalMasked`、`viewMode`。
- 首次加载仍默认显示隐私信息、列表模式。

## 6. 测试与验收

- 组件/App 测试覆盖分组隐藏只作用于当前可见标签、关闭分组需要确认且取消不调用 API、确认后关闭全部可见标签、全折叠/全展开状态。
- 测试 Side Panel 关闭调用正确的 windowId、失败时显示安全错误，且无内部 drawer 空白/aria-hidden 行为。
- 偏好测试覆盖旧 `drawerCollapsed` 字段不会进入保存结果。
- Manifest 测试覆盖最低 Chrome 版本 `141`。
- 完整执行 `npm test`、`npm run lint`、`npm run build` 和生产产物验证。
