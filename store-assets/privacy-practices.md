## Privacy practices tab / 隐私权规范

Answers for the **Privacy practices** tab of the Chrome Web Store developer dashboard. Each item is written in English (paste this into the dashboard) with a Chinese explanation. Verified against `public/manifest.json` and `src/` at the commit this file was added.

### Single purpose / 单一用途

> Tab Manager helps users find, switch to and organize the tabs open in their Chrome windows from a toolbar popup: search, group by window, domain or user-defined group, close, sort, and copy tab links or page content as Markdown.

中文：在工具栏弹窗中查找、切换和整理已打开的标签页（搜索、按窗口/域名/自定义分组、关闭、排序，以及复制标签链接或把页面内容复制为 Markdown）。"复制为 Markdown"是针对列表中某个标签页的操作，属于同一用途。

### Permission justifications / 权限理由

The manifest requests exactly these entries; there are no `host_permissions` and no content scripts.

| Manifest entry | Justification to paste | 中文说明 / 代码位置 |
| --- | --- | --- |
| `tabs` | Needed to read the title and URL of every open tab so the popup can list, search and group them by domain, and to activate, close and reorder tabs the user chooses. | 读取所有标签页的标题和网址用于列表、搜索、按域名分组；切换/关闭/排序标签页。`src/chrome/chromeTabs.ts`（`windows.getAll({populate:true})`、`tabs.update/remove/move`、tabs/windows 事件监听）。 |
| `favicon` | Shows each tab's site icon in the list using Chrome's local favicon cache (`/_favicon/`), so no request is made to the website or a third-party icon service. | 通过本地 `_favicon` 缓存显示网站图标，不发网络请求。`src/domain/tabs.ts` `resolveSafeFaviconUrl`。 |
| `clipboardWrite` | Writes to the clipboard when the user clicks "Copy link" or "Copy as Markdown" on a tab. The Markdown copy finishes after the page is read and converted, so the write happens after an asynchronous step. The extension never reads the clipboard. | 用户点击"复制链接"/"复制为 Markdown"时写入剪贴板；Markdown 需要先异步读取并转换页面，所以需要该权限保证写入成功。从不读取剪贴板。`src/App.tsx`（`navigator.clipboard.writeText`）。 |
| `scripting` | Used only by "Copy as Markdown": when the user clicks it, a single read-only function is injected into that tab to read the page's current HTML, which is converted to Markdown locally in the popup. No script runs on pages otherwise, and pages are never modified. | 仅用于"复制为 Markdown"：用户点击时向该标签页注入一个只读函数读取当前 HTML，在弹窗内本地转换。平时不在任何页面运行脚本，也不修改页面。`src/chrome/pageCapture.ts`（`scripting.executeScript`）。 |
| `optional_host_permissions: <all_urls>` | Optional, not granted at install. Requested with `permissions.request` the first time the user clicks "Copy as Markdown", because the user can copy any tab in the list, not just the active one, so `activeTab` is not sufficient. If the user declines, every other feature keeps working. | 可选权限，安装时不授予；用户首次点击"复制为 Markdown"时才请求。因为可以复制列表中任意标签页（而不只是当前标签页），`activeTab` 不够用。拒绝后其他功能不受影响。`src/chrome/pageCapture.ts` `ensurePageAccess`。 |

`windows` API calls (`windows.getAll`, `windows.update`, `windows.getLastFocused`) need no permission. Chrome internal pages and the Web Store are never scripted (`src/domain/captureUrl.ts`); local `file://` pages are only read when the user has also turned on "Allow access to file URLs".

### Remote code / 远程代码

> **No, I am not using remote code.**

All JavaScript is bundled in the package by Vite. The extension page CSP is `script-src 'self'; connect-src 'none'`, so it cannot load scripts or make network requests. Readability and Turndown (used for Markdown) are bundled npm dependencies.

### Data usage / 数据使用

What the code actually does:

| Data | Where it goes | 说明 |
| --- | --- | --- |
| Titles, URLs and favicons of open tabs | Read in memory to render the popup. Not sent anywhere. | 仅在内存中用于显示 |
| URLs of tabs the user adds to a custom group, those pages' last seen titles, custom group names | Stored in the extension's own `localStorage` on the device (`chrome-tabs.custom-groups.v1`) so closed entries stay recognizable and can be reopened. Not synced, not sent anywhere. | 用户主动加入自定义分组的网址、这些页面最近一次的标题及分组名，保存在本机扩展 `localStorage` |
| Preferences (view mode, language, theme, privacy toggle), pinned tab IDs and domain names, pinned/collapsed custom groups, pre-sort tab order (numeric IDs) | Stored locally in `localStorage`. | 偏好设置、置顶项、自定义分组的置顶/折叠状态、排序前的标签顺序（数字 ID） |
| Page HTML for "Copy as Markdown" | Read only on click, converted in memory, the result goes to the user's clipboard. Not stored, not sent. | 仅点击时读取，转换结果写入剪贴板，不保存不上传 |

No data is transmitted off the device: the CSP blocks all network connections and the code contains no `fetch`/`XMLHttpRequest`.

Recommended answers in the dashboard:

- **"What user data do you plan to collect from users now or in the future?"** — leave every category **unchecked**. In the Chrome Web Store's user data FAQ, data that is processed or stored only on the user's device and never transmitted to the developer or third parties is not "collected".
  - The privacy policy (`privacy-policy.{en,zh-CN,zh-TW}.md`) states the same: no category of user data is collected. Keep the two in sync if either changes.
- Certify all three statements:
  - ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
  - ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
  - ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.
- **Privacy policy URL** — host the privacy policy HTML pages (see `submission-checklist.md`) and paste the public URL of `privacy-policy.en.html`, or of the `privacy-policy.html` language picker.
