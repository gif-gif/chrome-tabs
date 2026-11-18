import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

export interface PageSnapshot {
  html: string
  url: string
  title: string
  /** True when the captured HTML was cut at the capture size limit. */
  truncated?: boolean
}

export interface MarkdownDocument {
  markdown: string
  title: string
  /** False when Readability found no article and the whole body was used. */
  extracted: boolean
}

export class EmptyPageError extends Error {
  constructor() {
    super('The page has no readable content.')
    this.name = 'EmptyPageError'
  }
}

const NON_CONTENT_SELECTOR = 'script, style, noscript, template, iframe, object, embed, link, meta'
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:'])
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:'])

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/**
 * The URL relative links resolve against: the page's own <base href> when it
 * has one, otherwise the page URL. A parsed copy cannot rely on <base> itself,
 * because the popup's CSP (base-uri 'none') applies to DOMParser documents.
 */
function resolveBaseUrl(document: Document, pageUrl: string): string {
  const declared = document.querySelector('base[href]')?.getAttribute('href')
  const resolved = declared ? resolveUrl(declared, pageUrl) : null
  return resolved && (resolved.protocol === 'http:' || resolved.protocol === 'https:' || resolved.protocol === 'file:')
    ? resolved.href
    : pageUrl
}

function resolveUrl(value: string, baseUrl: string): URL | null {
  try {
    return new URL(value.trim(), baseUrl)
  } catch {
    return null
  }
}

function unwrap(element: Element) {
  element.replaceWith(...element.childNodes)
}

function absolutizeSrcset(srcset: string, baseUrl: string): string {
  return srcset
    .split(',')
    .map((candidate) => {
      const [source, ...descriptor] = candidate.trim().split(/\s+/)
      const resolved = source ? resolveUrl(source, baseUrl) : null
      return resolved && SAFE_IMAGE_PROTOCOLS.has(resolved.protocol)
        ? [resolved.href, ...descriptor].join(' ')
        : ''
    })
    .filter(Boolean)
    .join(', ')
}

/**
 * Rewrites links and images in `root` to absolute URLs on the page. In-page
 * anchors keep pointing at the page, and links or images that cannot work
 * outside it (javascript:, data:, blob:) are dropped, keeping link text.
 */
export function absolutizeLinks(root: ParentNode, pageUrl: string) {
  for (const anchor of root.querySelectorAll('a')) {
    const href = anchor.getAttribute('href')
    const resolved = href ? resolveUrl(href, pageUrl) : null
    if (!resolved || !SAFE_LINK_PROTOCOLS.has(resolved.protocol)) {
      unwrap(anchor)
      continue
    }
    anchor.setAttribute('href', resolved.href)
  }

  for (const image of root.querySelectorAll('img')) {
    const src = image.getAttribute('src')
    const resolved = src ? resolveUrl(src, pageUrl) : null
    const srcset = image.getAttribute('srcset')
    const absoluteSrcset = srcset ? absolutizeSrcset(srcset, pageUrl) : ''
    const fallback = absoluteSrcset.split(/\s/)[0]
    if (resolved && SAFE_IMAGE_PROTOCOLS.has(resolved.protocol)) {
      image.setAttribute('src', resolved.href)
    } else if (fallback) {
      image.setAttribute('src', fallback)
    } else {
      image.remove()
      continue
    }
    if (absoluteSrcset) image.setAttribute('srcset', absoluteSrcset)
    else image.removeAttribute('srcset')
  }
}

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  })
  service.use(gfm)
  service.remove(['script', 'style', 'noscript', 'template'])
  return service
}

function yamlString(value: string): string {
  // JSON string escaping is valid YAML double-quoted scalar syntax.
  return JSON.stringify(value.replace(/\s+/g, ' ').trim())
}

export interface FrontMatter {
  title: string
  source: string
  site?: string | null
  author?: string | null
  published?: string | null
  captured: string
  truncated?: boolean
}

export function createFrontMatter(fields: FrontMatter): string {
  const lines = ['---', `title: ${yamlString(fields.title)}`, `source: ${yamlString(fields.source)}`]
  for (const key of ['site', 'author', 'published'] as const) {
    const value = fields[key]?.trim()
    if (value) lines.push(`${key}: ${yamlString(value)}`)
  }
  lines.push(`captured: ${yamlString(fields.captured)}`)
  if (fields.truncated) lines.push('truncated: true')
  lines.push('---')
  return lines.join('\n')
}

function formatLocalTimestamp(date: Date): string {
  const pad = (value: number) => String(Math.abs(value)).padStart(2, '0')
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
}

/**
 * Converts a captured page to Markdown: parse the HTML, extract the article
 * with Readability (falling back to the whole body), make links absolute,
 * convert with Turndown and prepend YAML front matter plus a title heading.
 * Parsing uses DOMParser, so page scripts never run in the popup.
 */
export function convertPageToMarkdown(
  snapshot: PageSnapshot,
  capturedAt: Date = new Date(),
): MarkdownDocument {
  const document = parseDocument(snapshot.html)
  const pageTitle = snapshot.title.trim() || document.title.trim()
  const baseUrl = resolveBaseUrl(document, snapshot.url)
  document.querySelectorAll('base').forEach((base) => base.remove())
  // Absolutize before Readability, which would otherwise resolve relative
  // links against the popup's own URL.
  absolutizeLinks(document, baseUrl)
  // isProbablyReaderable is skipped on purpose: its paragraph length check is
  // tuned for Latin text and rejects most Chinese articles. Readability itself
  // retries with looser rules and only fails on pages with no text at all.
  // keepClasses preserves language-* hints for fenced code blocks.
  const article = new Readability<HTMLElement>(document.cloneNode(true) as Document, {
    keepClasses: true,
    serializer: (node) => node as HTMLElement,
  }).parse()

  let content: HTMLElement | null = article?.content ?? null
  const extracted = Boolean(content?.textContent?.trim())
  if (!extracted) {
    content = document.body?.cloneNode(true) as HTMLElement | null
    content?.querySelectorAll(NON_CONTENT_SELECTOR).forEach((node) => node.remove())
  }
  if (!content) throw new EmptyPageError()

  absolutizeLinks(content, baseUrl)
  const body = createTurndown().turndown(content).trim()
  if (!body) throw new EmptyPageError()

  const title = (extracted ? article?.title?.trim() : '') || pageTitle || snapshot.url
  let site: string | null = article?.siteName?.trim() || null
  if (!site) {
    try {
      site = new URL(snapshot.url).hostname || null
    } catch {
      site = null
    }
  }
  const frontMatter = createFrontMatter({
    title,
    source: snapshot.url,
    site,
    author: article?.byline,
    published: article?.publishedTime,
    captured: formatLocalTimestamp(capturedAt),
    truncated: snapshot.truncated,
  })

  return {
    markdown: `${frontMatter}\n\n# ${title}\n\n${body}\n`,
    title,
    extracted,
  }
}
