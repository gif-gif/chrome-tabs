# 精简英文 README 设计规格

**日期：** 2026-07-23  
**状态：** 已确认方案 A，待书面规格复核

## 目标

为项目新增独立的精简英文介绍文件 `README.en.md`，让英文用户能够快速了解扩展用途、核心能力、安装方式和隐私行为，同时避免逐段翻译中文 README 所带来的篇幅和维护成本。

## 文件与导航

- 保留 `README.md` 作为完整的简体中文文档。
- 新增 `README.en.md` 作为精简英文文档。
- 两个文件顶部都提供语言导航：`简体中文 | English`。
- 当前语言使用普通文本，另一种语言使用相对 Markdown 链接，确保 GitHub 和本地浏览均可使用。

## 英文版结构

`README.en.md` 控制在约 50–70 行，包含以下内容：

1. **Project Overview**：一句话说明这是 Chrome Side Panel 标签页管理扩展。
2. **Key Features**：概括搜索与筛选、标签页切换与关闭、实时同步、列表与主域名分组、全局/分组/单标签页隐私隐藏、紧凑吸顶工具栏和中英文界面。
3. **Requirements**：Chrome 141+、Node.js、npm。
4. **Install, Test, and Build**：提供 `npm install`、`npm test`、`npm run lint`、`npm run build` 命令。
5. **Load in Chrome**：说明通过 `chrome://extensions` 的开发者模式加载 `<project-directory>/dist`。
6. **Privacy**：说明首次默认显示；仅全局隐私开关持久化；不会持久化标签页标题、URL、favicon、搜索内容或单标签页覆盖状态。
7. **Language Support**：说明支持简体中文和英文，默认跟随浏览器，不支持的语言回退英文，并允许手动切换。

## 内容约束

- 使用自然、简洁的英文，不逐段复刻中文 README。
- 不包含本地用户名或绝对路径。
- 不添加尚未实现的功能、权限、远程服务或数据收集声明。
- 构建目录 `dist` 继续由 `.gitignore` 排除，文档只说明如何生成。
- 不修改扩展代码、测试、依赖或 Manifest 权限。

## 验收标准

- `README.en.md` 存在，结构完整且保持精简。
- 两份 README 顶部可以互相切换语言。
- 命令、Chrome 加载目录和现有项目配置一致。
- 英文功能描述与当前实现一致。
- 文档中不存在本机绝对路径或敏感信息。
- Git 工作区只包含预期的文档变更。
