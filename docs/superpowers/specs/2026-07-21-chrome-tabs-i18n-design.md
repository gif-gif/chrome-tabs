# Chrome Tabs 中英文国际化设计规格

- 日期：2026-07-21
- 状态：用户已确认
- 技术方向：React + TypeScript + Vite + Chrome Extension Manifest V3

## 1. 目标

为 Chrome Tabs Side Panel 增加完整的简体中文和英文支持，覆盖 Side Panel 中所有用户可见文字及 Chrome 扩展元数据。默认跟随浏览器语言；不支持的浏览器语言回退英文；用户可以在界面中手动选择“自动 / 中文 / English”，选择会保存在本地。

## 2. 支持语言与解析规则

- 支持运行时语言：`zh-CN`、`en`。
- 支持用户偏好：`auto`、`zh-CN`、`en`。
- `auto` 模式按 `navigator.languages` 顺序解析，并回退读取 `navigator.language`：
  - 任意 `zh`、`zh-CN`、`zh-TW`、`zh-HK`、`zh-*` 映射为简体中文 `zh-CN`。
  - 任意 `en`、`en-*` 映射为英文 `en`。
  - 列表中第一个受支持语言决定界面语言。
  - 没有受支持语言时回退英文。
- 手动选择 `zh-CN` 或 `en` 时忽略浏览器语言，并持久化该选择。
- 用户切回 `auto` 后立即重新按当前浏览器语言解析。

## 3. 语言切换器

- 在固定顶部工具区加入紧凑的语言选择控件，放在显示模式切换附近。
- 选项为：自动（浏览器语言）/ 中文 / English；英文界面对应 Auto (browser) / 中文 / English。
- 控件始终可见，不依赖列表/分组视图。
- 控件必须有本地化 `aria-label`，支持键盘操作和窄 Side Panel 布局。
- 切换语言不刷新页面、不重新加载扩展，所有当前界面文本立即更新。
- 更新 `document.documentElement.lang` 为实际生效语言。

## 4. 翻译覆盖范围

Side Panel 内所有用户可见与无障碍文字均纳入字典，包括：

- 标签页数量、列表/分组模式、搜索框、筛选项。
- 全局、分组、单标签隐私操作。
- 分组全部折叠/展开、分组关闭确认、标签页关闭/切换。
- 当前窗口、其他窗口、当前标签、隐藏占位文本、特殊域名分组名称。
- 加载、空状态、查询/订阅/操作失败和重试文字。
- Side Panel 关闭按钮及其失败提示。
- 所有动态数量文案与动态 `aria-label`。

原始网页标题、URL 和可注册域名不是扩展界面翻译内容，保持原值。

## 5. 国际化架构

- 新增 `src/i18n/` 模块，包含：
  - 支持语言和偏好类型。
  - 中英文类型安全字典。
  - 浏览器语言解析纯函数。
  - 带变量插值的翻译函数。
- App 持有语言偏好和实际 locale，并把翻译器传给组件与领域展示函数。
- 领域函数不再硬编码中文展示文案；由 App 传入本地化展示文本或翻译器，保持纯函数与可测试性。
- `useChromeTabs` 的安全错误文案通过调用方传入或使用稳定错误码，避免 hook 内硬编码单一语言。
- 语言变化时不清空查询、筛选、折叠、脱敏或 pending 状态。

## 6. 偏好存储与兼容

现有偏好对象增加：

```ts
language: 'auto' | 'zh-CN' | 'en'
```

- 默认值为 `auto`。
- 继续使用现有版本化存储键，读取旧对象缺少 `language` 时迁移为 `auto`，不丢失 `globalMasked` 和 `viewMode`。
- 非法语言值回退 `auto`，其余合法偏好继续保留。
- 写入失败不影响 Side Panel 使用。

## 7. Chrome 扩展元数据国际化

- Manifest 增加 `default_locale: "en"`。
- `name`、`description`、`action.default_title` 改用 `__MSG_*__` 占位符。
- 新增：
  - `public/_locales/en/messages.json`
  - `public/_locales/zh_CN/messages.json`
- Chrome 扩展管理页和工具栏提示由 Chrome 自身根据浏览器 locale 选择；不支持语言按 `default_locale` 使用英文。
- Side Panel 内的手动语言选择只影响 Side Panel，不改变 Chrome 管理页中的扩展元数据语言。

## 8. 安全与隐私

- 国际化不得把脱敏前的标题、URL、favicon 或域名放入隐藏 DOM 或无障碍文本。
- 全部脱敏的域名组在两种语言下均使用通用名称。
- 原始异常信息不得因翻译或插值进入 DOM。
- 不增加网络请求、host permissions 或远程翻译资源。

## 9. 测试与验收

- 语言解析测试覆盖中文变体、英文变体、顺序优先、未知语言和空语言列表。
- 偏好测试覆盖旧对象迁移、合法手动语言、非法值与写入结果。
- App 测试覆盖默认浏览器语言、未知语言英文回退、手动切换和重载恢复。
- 中文与英文分别覆盖搜索、筛选、视图、隐私、分组、确认、状态、错误、Side Panel 按钮等关键文案。
- 切换语言后状态不丢失，脱敏 DOM 在两种语言下均不泄露原始数据。
- Manifest 测试验证 `default_locale`、`__MSG_*__` 和两份 locale 文件完整且 key 对齐。
- 完整执行 `npm test`、`npm run lint`、`npm run build` 和 `dist` 产物验证。
