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
