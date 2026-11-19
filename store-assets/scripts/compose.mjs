// Composes store screenshots and promo tiles from popup captures.
// Usage: node compose.mjs <shotsDir> <iconSvg> <outDir>
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const [shotsDir, iconSvg, outDir] = process.argv.slice(2).map((p) => path.resolve(p))
const icon = `data:image/svg+xml;base64,${fs.readFileSync(iconSvg).toString('base64')}`
const img = (name) => `data:image/png;base64,${fs.readFileSync(path.join(shotsDir, name)).toString('base64')}`

const COPY = {
  en: {
    name: 'Tab Manager',
    tagline: 'Find, group and tidy your open tabs from one compact popup.',
    shots: [
      ['list', 'Every tab, every window', 'See all open tabs at a glance. Click to jump, close, copy the link, save or pin, right from the list.'],
      ['domain', 'Grouped by website', 'Subdomains roll up under one site. Pin the groups you use most and close a whole group in one click.'],
      ['search', 'Instant search', 'Type a few letters to filter by title or URL across all windows.'],
      ['custom', 'Your own groups', 'Build groups like “Work” or “Trip” and keep them across sessions. Drag to reorder.'],
      ['dark-private', 'Privacy mode & dark theme', 'Hide titles and URLs when sharing your screen. Light, dark or follow the system.'],
    ],
  },
  'zh-CN': {
    name: '标签页管理器',
    tagline: '在一个紧凑的弹窗里查找、分组和整理所有标签页。',
    shots: [
      ['list', '所有窗口，一览无余', '一眼看到全部打开的标签页，点击即可切换，还能直接关闭、复制链接、收藏或置顶。'],
      ['domain', '按网站自动分组', '子域名归到同一个网站下。常用分组可以置顶，整组标签一键关闭。'],
      ['search', '即时搜索', '输入几个字，即可在所有窗口中按标题或网址筛选。'],
      ['custom', '自定义分组', '建立“工作”“旅行”等分组并长期保留，拖动即可调整顺序。'],
      ['dark-private', '隐私模式与暗色主题', '共享屏幕时一键隐藏标题和网址。支持浅色、暗色或跟随系统。'],
    ],
  },
}

const FONT = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

function screenshotHtml(locale, [scene, title, body], dark) {
  const bg = dark ? '#17181b' : '#eef3f6'
  const fg = dark ? '#e8eaed' : '#202124'
  const muted = dark ? '#bdc1c6' : '#4f5b62'
  const chrome = dark ? '#2b2c2f' : '#dee3e7'
  const bar = dark ? '#35363a' : '#ffffff'
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1280px;height:800px;overflow:hidden;font-family:${FONT};background:${bg};color:${fg};position:relative}
  .copy{position:absolute;left:80px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:22px}
  .brand{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:600;color:${muted}}
  .brand img{width:40px;height:40px}
  h1{font-size:46px;line-height:1.15;font-weight:700;letter-spacing:-0.5px}
  p{font-size:22px;line-height:1.55;color:${muted}}
  .browser{position:absolute;left:600px;top:56px;width:760px;height:800px;border-radius:14px 0 0 0;background:${chrome};box-shadow:0 20px 60px rgba(0,0,0,.18)}
  .tabs{height:44px;display:flex;align-items:flex-end;gap:6px;padding:0 16px}
  .tab{width:150px;height:34px;border-radius:10px 10px 0 0;background:${dark ? '#3c3d41' : '#e9edf0'}}
  .tab.on{background:${bar}}
  .bar{height:48px;background:${bar};display:flex;align-items:center;padding:0 14px;gap:12px}
  .omni{flex:1;height:32px;border-radius:16px;background:${dark ? '#202124' : '#f1f3f4'}}
  .ext{width:34px;height:34px;border-radius:50%;background:${dark ? '#4a4b4f' : '#e3eefb'};display:grid;place-items:center;margin-right:130px}
  .ext img{width:22px;height:22px}
  .page{position:absolute;left:0;right:0;top:92px;bottom:0;background:${dark ? '#202124' : '#fafbfc'}}
  .line{height:14px;border-radius:7px;background:${dark ? '#2f3034' : '#e8ecef'};margin:28px 40px 0}
  .popup{position:absolute;left:820px;top:150px;width:420px;height:600px;border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.08)}
  .popup img{width:420px;height:600px;display:block}
  </style></head><body>
  <div class="copy"><div class="brand"><img src="${icon}">${COPY[locale].name}</div><h1>${title}</h1><p>${body}</p></div>
  <div class="browser"><div class="tabs"><div class="tab on"></div><div class="tab"></div><div class="tab"></div><div class="tab"></div></div>
  <div class="bar"><div class="omni"></div><div class="ext"><img src="${icon}"></div></div>
  <div class="page"><div class="line" style="width:60%"></div><div class="line" style="width:80%"></div><div class="line" style="width:45%"></div><div class="line" style="width:70%"></div></div></div>
  <div class="popup"><img src="${img(`popup-${scene}.${locale}.png`)}"></div>
  </body></html>`
}

function promoHtml(locale, w, h) {
  const big = w > 1000
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${w}px;height:${h}px;overflow:hidden;font-family:${FONT};background:linear-gradient(135deg,#0f5f86 0%,#1788b1 55%,#45b9df 100%);color:#fff;position:relative}
  .copy{position:absolute;left:${big ? 110 : 30}px;top:0;bottom:0;width:${big ? 620 : 250}px;display:flex;flex-direction:column;justify-content:center;gap:${big ? 22 : 10}px}
  .icon{width:${big ? 112 : 64}px;height:${big ? 112 : 64}px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.25))}
  h1{font-size:${big ? 64 : 30}px;font-weight:700;letter-spacing:-0.5px;line-height:1.1}
  p{font-size:${big ? 28 : 15}px;line-height:1.45;color:rgba(255,255,255,.88)}
  .popup{position:absolute;left:${big ? 860 : 285}px;top:${big ? 60 : 36}px;width:420px;height:600px;border-radius:12px;overflow:hidden;transform-origin:top left;transform:scale(${big ? 1 : 0.5});box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .popup img{width:420px;height:600px;display:block}
  </style></head><body>
  <div class="copy"><img class="icon" src="${icon}"><h1>${COPY[locale].name}</h1><p>${COPY[locale].tagline}</p></div>
  <div class="popup"><img src="${img(`popup-domain.${locale}.png`)}"></div>
  </body></html>`
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
async function render(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.screenshot({ path: file, type: 'png', omitBackground: false })
  await page.close()
}
for (const locale of Object.keys(COPY)) {
  const dir = path.join(outDir, locale)
  fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true })
  let n = 0
  for (const shot of COPY[locale].shots) {
    n++
    await render(screenshotHtml(locale, shot, shot[0] === 'dark-private'), 1280, 800, path.join(dir, 'screenshots', `${n}-${shot[0]}-1280x800.png`))
  }
  await render(promoHtml(locale, 440, 280), 440, 280, path.join(dir, 'promo-small-440x280.png'))
  await render(promoHtml(locale, 1400, 560), 1400, 560, path.join(dir, 'promo-marquee-1400x560.png'))
}
await browser.close()
console.log('done')
