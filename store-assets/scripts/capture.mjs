// Renders the built popup (dist/) with a stubbed chrome.* API and demo tabs,
// then screenshots each scene. Usage: node capture.mjs <distDir> <outDir>
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const [distDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p))
fs.mkdirSync(outDir, { recursive: true })

const PALETTE = ['#1a73e8', '#e8710a', '#188038', '#a142f4', '#d93025', '#007b83', '#5f6368', '#f9ab00']
function faviconSvg(pageUrl) {
  let host = 'x'
  try { host = new URL(pageUrl).hostname.replace(/^www\./, '') } catch {}
  let h = 0
  for (const c of host) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const color = PALETTE[h % PALETTE.length]
  const letter = host[0].toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="${color}"/><text x="16" y="22" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/_favicon/') {
    res.writeHead(200, { 'content-type': 'image/svg+xml' })
    return res.end(faviconSvg(url.searchParams.get('pageUrl') ?? ''))
  }
  const file = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!file.startsWith(path.resolve(distDir)) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const DATA = {
  en: [
    [
      ['Pull requests · acme/web-app', 'https://github.com/acme/web-app/pulls'],
      ['Q4 Roadmap – Google Docs', 'https://docs.google.com/document/d/q4-roadmap'],
      ['Team Drive – Design files', 'https://drive.google.com/drive/folders/design'],
      ['Array.prototype.flatMap() - JavaScript | MDN', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap'],
      ['How to debounce a React hook? - Stack Overflow', 'https://stackoverflow.com/questions/12345/debounce-react-hook'],
      ['Q4 Roadmap – Google Docs', 'https://docs.google.com/document/d/q4-roadmap'],
      ['Chrome Extensions: tabs API', 'https://developer.chrome.com/docs/extensions/reference/api/tabs'],
    ],
    [
      ['Flights to Lisbon – Travel search', 'https://www.example-travel.com/flights/lisbon'],
      ['Hotel Alfama – Booking details', 'https://www.example-travel.com/hotels/alfama'],
      ['Weekend recipes: 20-minute dinners', 'https://cooking.example.org/weekend'],
      ['Issues · acme/design-system', 'https://github.com/acme/design-system/issues'],
      ['Monthly budget – Google Sheets', 'https://docs.google.com/spreadsheets/d/budget'],
    ],
  ],
  'zh-CN': [
    [
      ['Pull requests · acme/web-app', 'https://github.com/acme/web-app/pulls'],
      ['第四季度路线图 – Google 文档', 'https://docs.google.com/document/d/q4-roadmap'],
      ['团队云端硬盘 – 设计稿', 'https://drive.google.com/drive/folders/design'],
      ['Array.prototype.flatMap() - JavaScript | MDN', 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap'],
      ['如何给 React Hook 加防抖？ - Stack Overflow', 'https://stackoverflow.com/questions/12345/debounce-react-hook'],
      ['第四季度路线图 – Google 文档', 'https://docs.google.com/document/d/q4-roadmap'],
      ['Chrome 扩展：tabs API', 'https://developer.chrome.com/docs/extensions/reference/api/tabs'],
    ],
    [
      ['飞往里斯本的航班 – 旅行搜索', 'https://www.example-travel.com/flights/lisbon'],
      ['阿尔法玛酒店 – 预订详情', 'https://www.example-travel.com/hotels/alfama'],
      ['周末食谱：20 分钟快手晚餐', 'https://cooking.example.org/weekend'],
      ['Issues · acme/design-system', 'https://github.com/acme/design-system/issues'],
      ['月度预算 – Google 表格', 'https://docs.google.com/spreadsheets/d/budget'],
    ],
  ],
  'zh-TW': [
    [
      ['Pull requests · acme/web-app', 'https://github.com/acme/web-app/pulls'],
      ['第四季路線圖 – Google 文件', 'https://docs.google.com/document/d/q4-roadmap'],
      ['團隊雲端硬碟 – 設計稿', 'https://drive.google.com/drive/folders/design'],
      ['Array.prototype.flatMap() - JavaScript | MDN', 'https://developer.mozilla.org/zh-TW/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap'],
      ['如何替 React Hook 加上防抖？ - Stack Overflow', 'https://stackoverflow.com/questions/12345/debounce-react-hook'],
      ['第四季路線圖 – Google 文件', 'https://docs.google.com/document/d/q4-roadmap'],
      ['Chrome 擴充功能：tabs API', 'https://developer.chrome.com/docs/extensions/reference/api/tabs'],
    ],
    [
      ['飛往里斯本的航班 – 旅遊搜尋', 'https://www.example-travel.com/flights/lisbon'],
      ['阿爾法瑪飯店 – 訂房詳情', 'https://www.example-travel.com/hotels/alfama'],
      ['週末食譜：20 分鐘快速晚餐', 'https://cooking.example.org/weekend'],
      ['Issues · acme/design-system', 'https://github.com/acme/design-system/issues'],
      ['每月預算 – Google 試算表', 'https://docs.google.com/spreadsheets/d/budget'],
    ],
  ],
}

// LOCALES=zh-TW node capture.mjs ... captures only the listed locales.
const LOCALES = process.env.LOCALES ? process.env.LOCALES.split(',') : Object.keys(DATA)

function buildWindows(locale) {
  let id = 100
  return DATA[locale].map((tabs, w) => ({
    id: w + 1,
    focused: w === 0,
    type: 'normal',
    tabs: tabs.map(([title, url], index) => ({ id: ++id, windowId: w + 1, index, active: index === 1, title, url })),
  }))
}

function stub({ windows, storage }) {
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v)
  const ev = () => ({ addListener() {}, removeListener() {} })
  const ok = async () => undefined
  globalThis.chrome = {
    windows: {
      getAll: async () => structuredClone(windows),
      getLastFocused: async () => ({ id: 1 }),
      update: ok, create: ok,
      onCreated: ev(), onRemoved: ev(), onFocusChanged: ev(),
    },
    tabs: {
      update: ok, remove: ok, move: ok,
      get: async (id) => windows.flatMap((w) => w.tabs).find((t) => t.id === id),
      onCreated: ev(), onUpdated: ev(), onMoved: ev(), onActivated: ev(), onRemoved: ev(),
      onAttached: ev(), onDetached: ev(), onReplaced: ev(),
    },
  }
}

const prefs = (extra) => JSON.stringify({
  version: 1, globalMasked: false, viewMode: 'list', language: 'auto', colorScheme: 'light',
  pinnedTabIds: [], pinnedDomainKeys: [], ...extra,
})

const SCENES = [
  { name: 'list', prefs: {}, hover: 'drive.google.com/drive' },
  { name: 'domain', prefs: { viewMode: 'domain', pinnedDomainKeys: ['google.com'] } },
  { name: 'search', prefs: {}, search: 'docs' },
  {
    name: 'custom', prefs: { viewMode: 'custom' },
    groups: [
      { id: 'g1', name: 'Work', zh: '工作', pinned: true, urls: ['https://github.com/acme/web-app/pulls', 'https://docs.google.com/document/d/q4-roadmap', 'https://github.com/acme/design-system/issues'] },
      { id: 'g2', name: 'Trip', zh: '旅行', urls: ['https://www.example-travel.com/flights/lisbon', 'https://www.example-travel.com/hotels/alfama'] },
    ],
  },
  { name: 'dark-private', prefs: { colorScheme: 'dark', viewMode: 'domain', globalMasked: true } },
]

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
for (const locale of LOCALES) {
  const windows = buildWindows(locale)
  for (const scene of SCENES) {
    const context = await browser.newContext({ viewport: { width: 420, height: 600 }, deviceScaleFactor: 2, locale })
    const storage = { 'chrome-tabs.ui-preferences.v1': prefs(scene.prefs) }
    if (scene.groups) {
      storage['chrome-tabs.custom-groups.v1'] = JSON.stringify({
        version: 1,
        groups: scene.groups.map(({ zh, ...g }) => ({ ...g, name: locale === 'en' ? g.name : zh })),
      })
    }
    await context.addInitScript(stub, { windows, storage })
    const page = await context.newPage()
    page.on('pageerror', (e) => console.error(scene.name, e.message))
    await page.goto(`${base}/index.html`)
    await page.waitForTimeout(800)
    if (scene.search) {
      await page.getByRole('searchbox').first().fill(scene.search)
      await page.waitForTimeout(400)
    }
    await page.mouse.move(0, 599)
    if (scene.hover) {
      await page.getByText(scene.hover).first().hover()
      await page.waitForTimeout(300)
    }
    await page.screenshot({ path: path.join(outDir, `popup-${scene.name}.${locale}.png`) })
    await context.close()
  }
}
await browser.close()
server.close()
console.log('done')
