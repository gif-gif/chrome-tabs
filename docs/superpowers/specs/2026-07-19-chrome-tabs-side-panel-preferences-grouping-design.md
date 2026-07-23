# Chrome Tabs Side Panel 偏好、域名分组与抽屉优化设计规格

- 日期：2026-07-19
- 状态：用户已确认
- 技术方向：React + TypeScript + Vite + Chrome Extension Manifest V3

## 1. 目标

在现有标签页管理 Side Panel 上完成四项优化：默认显示内容并记忆全局隐私偏好；提供普通列表与主域名分组两种视图；去掉标题并固定顶部搜索工具区；提供不关闭 Side Panel 的抽屉式快速隐藏/恢复。

## 2. 隐私偏好

- 首次打开时 `globalMasked=false`，标题、URL 和 favicon 默认可见。
- 仅持久化全局隐藏开关；单个 Tab 的覆盖状态继续只存在于当前 React 页面内存。
- 全局隐藏开关使用扩展页面的 `localStorage` 保存，读取失败或值损坏时回退到默认可见。
- 全局开关改变时继续清除所有单 Tab 覆盖。
- 全局与单 Tab 的按钮只显示眼睛/闭眼图标，不显示可见文字；保留动态 `aria-label`。
- 隐藏行仍不得把原始标题、URL、favicon 或敏感无障碍属性渲染进 DOM。

## 3. 显示模式

- `list` 为首次默认视图，保持当前按 Chrome 窗口分组的列表形式。
- 用户可切换到 `domain` 视图，选择持久化到 `localStorage`。
- 域名视图在当前搜索/筛选结果上，跨浏览器窗口按可注册主域名归组。
- 使用 Public Suffix 数据解析可注册主域名，因此 `docs.google.com`、`drive.google.com`、`www.google.com`、`xaa.bac.google.com` 都归入 `google.com`，并正确处理 `example.com.cn` 等公共后缀。
- `localhost` 和 IP 地址按 hostname 自身分组；`chrome://`、`chrome-extension://` 等非 HTTP(S) 页面按 scheme/host 生成稳定、非空分组；无法解析的地址进入“其他页面”。
- 每个域名分组显示数量并支持展开/折叠；折叠状态为当前页面内存状态。
- 两种视图复用相同的搜索、筛选、激活、关闭、单 Tab 隐私和实时同步数据。
- 域名分组标题属于从 URL 派生的信息；当全局隐藏开启时，分组标题使用不敏感的顺序标签（如“网站分组 1”），不得暴露主域名。

## 4. 固定顶部工具区

- 删除“标签页管理器”标题文字。
- 顶部工具区保留标签页数量、全局隐私图标、搜索框、筛选和列表/域名切换。
- 顶部工具区使用 `position: sticky; top: 0`，Tab 列表滚动时始终固定，并使用不透明/模糊背景隔离滚动内容。

## 5. 抽屉式快速隐藏

- Side Panel 靠网页的一侧（左边缘）垂直居中放置左右箭头按钮。
- 点击收起后，应用主体向右滑出，只保留窄边和反向箭头；不调用 `chrome.sidePanel.close()`。
- 再次点击立即恢复完整内容。
- 折叠状态持久化到 `localStorage`，损坏值回退为展开。
- 按钮支持键盘、动态 `aria-label`、焦点环；动画遵循 `prefers-reduced-motion`。
- Chrome 分配给 Side Panel 的实际宽度不会改变，本功能仅快速隐藏内容并减少视觉干扰。

## 6. 本地偏好键

使用单一版本化 JSON 对象，避免多个键发生部分写入：

```ts
interface UiPreferences {
  version: 1
  globalMasked: boolean
  viewMode: 'list' | 'domain'
  drawerCollapsed: boolean
}
```

存储键：`chrome-tabs.ui-preferences.v1`。

## 7. 测试与验收

- 偏好纯函数覆盖：缺失、合法、损坏、旧字段/错误类型与写入失败。
- 域名解析覆盖：多级子域、复合公共后缀、localhost、IPv4/IPv6、特殊 scheme 和无效 URL。
- App 覆盖：首次默认可见、持久化恢复、只记忆全局不记忆单 Tab、视图切换、隐私下域名标题不泄露、抽屉恢复。
- 组件覆盖：标题删除、仅图标隐私按钮、固定工具区结构、域名组折叠。
- 完整执行 `npm test`、`npm run lint`、`npm run build` 和生产产物验证。
