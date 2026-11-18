import type { PageSnapshot } from '../domain/markdown'

/** Host access is requested once, at first use, from optional_host_permissions. */
export const PAGE_ACCESS_ORIGINS = ['<all_urls>']
/** Upper bound on captured HTML so huge pages cannot stall the popup. */
export const MAX_CAPTURED_HTML_LENGTH = 2_000_000

export type PageCaptureErrorCode =
  | 'unsupported'
  | 'fileAccess'
  | 'permissionDenied'
  | 'unloaded'
  | 'failed'

export class PageCaptureError extends Error {
  constructor(readonly code: PageCaptureErrorCode, cause?: unknown) {
    super(`Page capture failed: ${code}`, { cause })
    this.name = 'PageCaptureError'
  }
}

export type CaptureUrlKind = 'web' | 'file' | 'unsupported'

/**
 * Chrome forbids scripting its own pages, other extensions and the Web Store,
 * so only web pages and (with the user's opt-in) local files can be captured.
 */
export function classifyCaptureUrl(url: string): CaptureUrlKind {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'unsupported'
  }
  if (parsed.protocol === 'file:') return 'file'
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'unsupported'
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'chromewebstore.google.com' ||
    (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore'))
  ) {
    return 'unsupported'
  }
  return 'web'
}

/**
 * Runs inside the captured page. It must stay self-contained because Chrome
 * serializes it into the page; it only reads the current DOM.
 */
function readPageSnapshot(maxLength: number): PageSnapshot {
  const html = document.documentElement ? document.documentElement.outerHTML : ''
  const truncated = html.length > maxLength
  return {
    html: truncated ? html.slice(0, maxLength) : html,
    url: location.href,
    title: document.title,
    truncated,
  }
}

function isPageSnapshot(value: unknown): value is PageSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PageSnapshot>
  return (
    typeof candidate.html === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.title === 'string'
  )
}

async function ensurePageAccess(chromeApi: typeof chrome) {
  // request() must run while the click that started the capture still counts
  // as a user gesture, so it is the first awaited call. It resolves to true
  // without a prompt once access was granted.
  if (!(await chromeApi.permissions.request({ origins: PAGE_ACCESS_ORIGINS }))) {
    throw new PageCaptureError('permissionDenied')
  }
}

/**
 * Captures the live DOM of a tab, as the user currently sees it, without any
 * network request. Asks for site access the first time it is used.
 */
export async function capturePage(
  chromeApi: typeof chrome,
  tabId: number,
  url: string,
): Promise<PageSnapshot> {
  const kind = classifyCaptureUrl(url)
  if (kind === 'unsupported') throw new PageCaptureError('unsupported')
  if (!chromeApi.scripting?.executeScript || !chromeApi.permissions?.request) {
    throw new PageCaptureError('failed')
  }

  await ensurePageAccess(chromeApi)

  if (kind === 'file' && !(await chromeApi.extension.isAllowedFileSchemeAccess())) {
    throw new PageCaptureError('fileAccess')
  }

  const tab = await chromeApi.tabs.get(tabId)
  if (tab.discarded || tab.status === 'unloaded') {
    throw new PageCaptureError('unloaded')
  }

  let results: chrome.scripting.InjectionResult<PageSnapshot>[]
  try {
    results = await chromeApi.scripting.executeScript({
      target: { tabId },
      func: readPageSnapshot,
      args: [MAX_CAPTURED_HTML_LENGTH],
    })
  } catch (error) {
    throw new PageCaptureError('failed', error)
  }

  const snapshot = results[0]?.result
  if (!isPageSnapshot(snapshot)) throw new PageCaptureError('failed')
  return snapshot
}
