**English** | [简体中文](privacy-policy.zh-CN.md) | [繁體中文](privacy-policy.zh-TW.md)

## Tab Manager Privacy Policy

_Effective date: 2026-11-22 · Last updated: 2026-11-22_

Tab Manager ("the extension") is a Chrome extension for finding and organizing open browser tabs. This policy explains what information the extension handles. In short: **everything stays on your device. The extension does not collect any user data, and it does not transmit, sell or share any of your data.**

### Information the extension accesses

- **Open tabs.** With the `tabs` permission the extension reads the titles, URLs and icons of your open tabs to show, search and group them in its popup. This information is used in memory only while the popup is open and is not saved. Site icons come from Chrome's local favicon cache, not from the websites.
- **Page content, only when you ask.** When you click "Copy as Markdown" on a tab, the extension reads that page's current HTML once, converts it to Markdown inside the popup and places the result on your clipboard. The page content and the result are not saved or uploaded. The extension asks for site access the first time you use this feature; you can decline or revoke it at any time in `chrome://extensions`.
- **Clipboard.** The extension writes to the clipboard only when you click "Copy tab link" or "Copy as Markdown". It never reads your clipboard.

### Information stored on your device

So your setup is kept between sessions, the extension saves the following in its own `localStorage` on your computer:

- your preferences: view mode, language, appearance and the privacy (hide titles and URLs) toggle;
- your custom groups: their names, the URLs of the tabs you add to them, whether a group is pinned and which groups are collapsed;
- the tabs and domains you pin;
- the tab order before you sort by domain, so it can be restored (numeric tab and window IDs only).

Search text and per-tab or per-group privacy overrides are not saved. The stored data is not synced to your Google account and is not sent anywhere. It is removed when you uninstall the extension.

### What the extension does not do

- It makes no network requests. Its content security policy blocks all network connections, so your data never leaves your device.
- It does not use analytics, advertising, tracking or any third-party service.
- It does not collect any category of user data, and it does not sell, transfer or share data with anyone or use it for any purpose other than the features described above.
- It does not modify the web pages you visit.

### Changes

If this policy changes, the updated version will be published at this address with a new "Last updated" date.

### Contact

Questions about this policy: `<CONTACT_EMAIL>`
