# GitHub 默认英文 README 设计规格

**日期：** 2026-07-23  
**状态：** 已确认

## 目标

让 GitHub 仓库首页默认显示精简英文项目介绍，同时保留现有完整中文文档，并通过相对链接在两种语言之间切换。

## 文件迁移

实施完成后，仓库根目录只保留以下两个 README 文件：

- `README.md`：精简英文文档，GitHub 仓库首页默认显示。
- `README.zh-CN.md`：现有完整简体中文文档。

迁移方式：

1. 将当前 `README.md` 的完整中文内容移动到 `README.zh-CN.md`。
2. 将当前 `README.en.md` 的精简英文内容移动到 `README.md`。
3. 删除迁移后不再需要的 `README.en.md`，避免维护两份相同的英文内容。

## 语言导航

两个文件的语言导航都必须紧接主标题，位于第 2 行，第 3 行为空：

英文 `README.md`：

```markdown
# Chrome Tab Manager
[简体中文](README.zh-CN.md) | English
```

中文 `README.zh-CN.md`：

```markdown
# Chrome 标签页管理器
简体中文 | [English](README.md)
```

所有链接均使用仓库内相对路径，可在 GitHub 和本地 Markdown 阅读器中使用。

## 内容与范围

- 英文内容保持当前精简版本，不扩写为中文文档的逐段翻译。
- 中文内容除语言导航目标外保持完整，不删减功能、构建、隐私或国际化说明。
- 历史设计规格和实施计划保留原有文件名描述，作为当时实施记录，不进行追溯改写。
- 不修改扩展源码、测试、依赖、Manifest、构建配置或权限。
- 不新增第三份 README、重定向文件、符号链接或重复英文内容。

## 验收标准

- GitHub 默认 README 文件 `README.md` 为英文。
- `README.zh-CN.md` 为完整中文文档。
- 根目录不存在 `README.en.md`。
- 两份文档的导航位于第 2 行，第 3 行为空，链接目标存在。
- 英文 README 仍包含 Key Features、Requirements、构建、Chrome 加载、Privacy 和 Language Support。
- 中文文档除导航链接外与迁移前内容一致。
- 文档中不存在本地绝对路径、敏感信息或未解决占位符。
- Git 变更仅涉及 README 文件迁移和本规格/计划记录。
