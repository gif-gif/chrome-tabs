# Chrome Tab Manager
[简体中文](README.zh-CN.md) | English

A compact local Chrome extension for finding and managing many open tabs from a toolbar popup without taking space from the current webpage.

## Features

- Search tab titles and URLs; filter by all tabs, the current window, or active tabs.
- Click a tab to focus it, or close tabs directly from the popup.
- Stay synchronized as tabs and windows are created, updated, moved, activated, or closed.
- Switch between a window list and registrable-domain groups. Subdomains such as `docs.google.com` and `drive.google.com` are grouped under `google.com`.
- Hide sensitive tab information globally, by domain group, or per tab.
- Use a compact sticky toolbar with privacy, grouping, view, and language controls.
- Use Simplified Chinese or English; the default follows the browser language and falls back to English.

## Requirements

- Chrome 141 or later
- Node.js and npm

## Build

```bash
npm install
npm test
npm run lint
npm run build
```

The unpacked production extension is generated in `dist`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `<project-directory>/dist`.
4. Click the extension icon in the Chrome toolbar to open the popup.

The popup closes automatically when it loses focus and does not reduce the webpage's available width.

## Privacy and Permissions

Tab information is visible by default. The global privacy setting, view mode, and language preference are stored locally. Search text, group expansion state, and per-tab or per-group privacy overrides live only for the current popup instance.

The extension does not persist tab titles, URLs, or favicons and sends no browsing data to a remote service. It requests only the `tabs` and `favicon` permissions, with no host permissions.
