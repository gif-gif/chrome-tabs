# Chrome Tab Manager
[简体中文](README.md) | English

## Project Overview

Chrome Tab Manager is a local Chrome Side Panel extension for finding and managing large numbers of open tabs without leaving the current page.

## Key Features

- Search tab titles and URLs, then filter by all tabs, the current window, or active tabs.
- Click a tab to switch to it, or close tabs directly from the Side Panel.
- Keep the list synchronized as Chrome tabs and windows are created, updated, moved, activated, or closed.
- Switch between a window-based list and groups based on registrable domains, so subdomains such as docs.google.com and drive.google.com belong to google.com.
- Hide sensitive information globally, by domain group, or for an individual tab.
- Use a compact, progressively sticky toolbar with quick view, privacy, grouping, and language controls.
- Use the interface in Simplified Chinese or English.

## Requirements

- Chrome 141 or later
- Node.js
- npm

## Install, Test, and Build

Run the following commands from the project root:

```bash
npm install
npm test
npm run lint
npm run build
```

The production extension is generated in the `dist` directory.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose `<project-directory>/dist`.
6. Open the extension from the Chrome toolbar to use its Side Panel.

## Privacy

- Tab information is visible by default on first use.
- Of the privacy controls, only the global privacy setting is persisted; group and per-tab privacy overrides remain in memory for the current Side Panel page.
- The extension does not persist tab titles, URLs, favicons, search text, group expansion state, or per-tab privacy overrides.
- Hidden tabs do not render their original title, URL, or favicon in the corresponding visible or accessible tab content.
- Requested permissions are limited to `tabs`, `favicon`, and `sidePanel`.
- The extension requests no host permissions.

## Language Support

The interface supports Simplified Chinese and English. It follows the browser language by default, falls back to English when the language is unsupported, and also allows manual language selection.
