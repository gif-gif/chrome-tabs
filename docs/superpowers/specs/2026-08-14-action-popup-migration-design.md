# Chrome Action Popup 迁移设计

**日期：** 2026-08-14

## 目标

将标签页管理器从固定占用浏览器宽度的 Chrome Side Panel 迁移为工具栏 Action Popup。用户点击扩展图标时打开弹窗；点击弹窗外部、切换窗口或按 Escape 后由 Chrome 自动关闭，不占用网页布局空间。

## 保留能力

- 搜索标题与 URL
- 全部 / 当前窗口 / 活动标签筛选
- 点击切换标签页、关闭标签页
- 按窗口列表与按主域名分组
- 标签页事件实时同步
- 全局、分组和单标签页隐私隐藏
- 简体中文 / 英文国际化和浏览器语言自动选择
- 搜索框滚动吸顶及紧凑工具栏

## 扩展入口与权限

- `action.default_popup` 指向 `index.html`。
- 移除 `sidePanel` 权限和 `side_panel` manifest 配置。
- 移除仅用于 `setPanelBehavior` 的后台 service worker。
- 权限保持为 `tabs` 与 `favicon`，继续不声明 `host_permissions`。
- 保留工具栏标题、图标和扩展页面 CSP。

## Popup 布局

- 默认宽度为 420px，高度为 600px，并受当前浏览器可用视口约束。
- `html`、`body`、`#root` 构成固定大小的 popup 容器，禁止横向溢出。
- React 根节点使用 `popup-shell`，内部 `popup-content` 独立纵向滚动。
- 搜索工具栏继续在内部滚动容器顶部 sticky。
- 保留 340px 等窄宽布局规则，避免小窗口下横向滚动。
- 不增加显式关闭按钮；弹窗关闭遵循 Chrome 原生 popup 生命周期。

## 删除的 Side Panel 行为

- 删除中间边缘收起/关闭箭头及其组件、样式和测试。
- 删除 `chrome.sidePanel.close()` 适配器、错误消息和状态。
- 删除 Side Panel 后台初始化脚本。
- 不再保存或描述 Side Panel 关闭状态。

## 状态生命周期

全局隐私、视图模式和语言偏好继续保存在本地。单标签页/分组隐私覆盖、搜索文本和折叠状态仅存在于当前 popup 实例，popup 关闭后清除。

## 验收标准

1. 点击扩展工具栏图标打开 `index.html` popup。
2. Manifest 中不存在 Side Panel 权限、配置和后台 worker。
3. Popup 内完整保留现有标签页管理功能。
4. 页面不再出现 Side Panel 关闭箭头或相关文案。
5. Popup 为紧凑固定尺寸，列表内部可滚动且无横向溢出。
6. 中英文元数据和 README 均使用 popup 描述。
7. 单元测试、ESLint、TypeScript、Vite 构建和最终 `dist` 校验全部通过。
