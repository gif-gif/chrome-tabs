## Chrome Web Store submission checklist / 上架检查清单

Items marked 👤 need a human (account, payment, decisions). Everything else was checked against the code when this folder was added.

### 1. Account / 开发者账号 👤

- [ ] Register a Chrome Web Store developer account at https://chrome.google.com/webstore/devconsole and pay the one-time US$5 registration fee. / 注册开发者账号并支付一次性 5 美元注册费。
- [ ] Turn on 2-Step Verification on the Google account (required to publish). / 开启两步验证。
- [ ] Verify the contact email in **Account** settings. / 验证联系邮箱。
- [ ] Complete the trader / non-trader declaration (EU Digital Services Act). / 填写交易者声明。
- [ ] Decide the publisher name shown on the listing. / 确定发布者名称。

### 2. Manifest / 清单文件

| Check | Current state | Action |
| --- | --- | --- |
| `manifest_version` | 3 ✅ | — |
| `version` | `0.0.1` | 👤 Optional: bump to e.g. `1.0.0` in both `public/manifest.json` and `package.json` before the first release. Each later upload needs a higher version. |
| `name` / `description` | Localized via `_locales/en`, `_locales/zh_CN`, and `_locales/zh_TW` ✅ (≤ 75 / ≤ 132 characters) | 👤 Optional: adopt the more descriptive name/summary in `listing.*.md` (code change). |
| `default_locale` | `en` ✅ | — |
| Icons | 16 / 32 / 48 / 128 PNG present ✅ | — |
| `minimum_chrome_version` | `141` | 👤 Confirm this is intended; older Chrome users cannot install. |
| CSP | `script-src 'self'; connect-src 'none'` ✅ no remote code | — |

### 3. Permissions minimization / 权限最小化

- [x] `tabs`, `favicon`, `clipboardWrite`, `scripting` — each used, see `privacy-practices.md`.
- [x] No install-time `host_permissions`; `<all_urls>` is only in `optional_host_permissions` and requested on first "Copy as Markdown".
- [x] No content scripts, no background service worker, no `storage` permission (uses page `localStorage`).
- [ ] 👤 Be aware: `<all_urls>` (even optional) together with `scripting` may put the item into a longer, in-depth review. Removing it would require dropping or redesigning "Copy as Markdown" for non-active tabs.

### 4. Build and package / 构建与打包

```bash
npm ci
npm test
npm run lint
npm run build            # also runs build/validateDist.ts
cd dist && zip -r ../chrome-tabs-<version>.zip . -x '.*' && cd ..
```

- [ ] `manifest.json` must be at the **root** of the zip (zip the contents of `dist/`, not the folder). Verified: 16 files, ~465 KB uncompressed, no source maps.
- [ ] Load `dist/` with **Load unpacked** in `chrome://extensions` and smoke-test: open popup, search, switch the three views, close a tab, copy link, copy as Markdown (accept the site-access prompt), toggle privacy and dark mode.
- [ ] Do not include `store-assets/`, `src/`, `node_modules/` in the zip.

### 5. Store listing / 商店信息

- [ ] Paste the detailed description from `listing.en.md` (English), `listing.zh-CN.md` (简体中文 / zh_CN tab) and `listing.zh-TW.md` (繁體中文 / zh_TW tab).
- [ ] Category: Productivity → Workflow & Planning.
- [ ] Upload `images/icon-128.png` (128×128, artwork inside the 16 px padding).
- [ ] Upload 3–5 screenshots per language from `images/<locale>/screenshots/` (1280×800, 24-bit PNG, no alpha).
- [ ] Upload small promo tile `images/<locale>/promo-small-440x280.png`; optionally marquee `promo-marquee-1400x560.png`.
- [ ] 👤 Support URL / homepage URL (e.g. the GitHub repository) — only if the repository is public.

Screenshots are rendered from the real built popup (`dist/index.html`) with demo tabs; favicons are neutral letter tiles, not third-party logos. Regenerate with `scripts/` (see `README.md`) after UI changes.

### 6. Privacy / 隐私

- [ ] Fill the **Privacy practices** tab from `privacy-practices.md` (single purpose, five justifications, remote code = No, data usage, three certifications).
- [ ] 👤 Replace `<CONTACT_EMAIL>` in `privacy-policy.md` and `privacy-policy.html` with a public contact address.
- [ ] 👤 Host `privacy-policy.html` at a public URL and paste it into the dashboard. Options: GitHub Pages for this repo, a personal site, or a Gist. A private repository's file link does **not** work.
- [ ] 👤 Pick one data-collection answer (none vs. conservative) and keep the privacy policy consistent with it.

### 7. Submit / 提交 👤

- [ ] Upload the zip in the developer dashboard → **New item**.
- [ ] Distribution: Public / Unlisted / Private; regions (all by default).
- [ ] Optionally choose "Defer publish" to publish manually after approval.
- [ ] Submit for review; reviews usually take a few days, longer with broad host permissions.

### Known mismatch to fix separately / 需另行修正

The repository `README.md` / `README.zh-CN.md` say the extension "does not persist tab titles, URLs". Custom groups do store the chosen URLs locally (`src/preferences/customGroups.ts`). The privacy materials here describe the actual behavior; the README wording should be updated in a separate change.
