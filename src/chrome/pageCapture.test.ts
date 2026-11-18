import { describe, expect, it, vi } from 'vitest'
import {
  MAX_CAPTURED_HTML_LENGTH,
  PAGE_ACCESS_ORIGINS,
  PageCaptureError,
  capturePage,
  classifyCaptureUrl,
} from './pageCapture'

function createChromeMock({
  grant = true,
  fileAccess = true,
  tab = { id: 7, status: 'complete', discarded: false },
  results = [{ result: { html: '<p>Hi</p>', url: 'https://example.com/', title: 'Hi' } }] as unknown[],
} = {}) {
  return {
    permissions: {
      request: vi.fn().mockResolvedValue(grant),
    },
    extension: { isAllowedFileSchemeAccess: vi.fn().mockResolvedValue(fileAccess) },
    tabs: { get: vi.fn().mockResolvedValue(tab) },
    scripting: { executeScript: vi.fn().mockResolvedValue(results) },
  }
}

const asChrome = (mock: ReturnType<typeof createChromeMock>) => mock as unknown as typeof chrome

async function captureError(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (reason: unknown) => reason)
  expect(error).toBeInstanceOf(PageCaptureError)
  return (error as PageCaptureError).code
}

describe('classifyCaptureUrl', () => {
  it.each([
    ['https://example.com/a', 'web'],
    ['http://192.168.1.2:8080/', 'web'],
    ['file:///Users/me/notes.html', 'file'],
    ['chrome://extensions/', 'unsupported'],
    ['chrome-extension://abc/index.html', 'unsupported'],
    ['https://chromewebstore.google.com/detail/x', 'unsupported'],
    ['https://chrome.google.com/webstore/detail/x', 'unsupported'],
    ['about:blank', 'unsupported'],
    ['not a url', 'unsupported'],
  ])('%s is %s', (url, kind) => {
    expect(classifyCaptureUrl(url)).toBe(kind)
  })
})

describe('capturePage', () => {
  it('reads the live page through scripting once access is granted', async () => {
    const chromeApi = createChromeMock()

    await expect(capturePage(asChrome(chromeApi), 7, 'https://example.com/')).resolves.toEqual({
      html: '<p>Hi</p>',
      url: 'https://example.com/',
      title: 'Hi',
    })
    expect(chromeApi.permissions.request).toHaveBeenCalledWith({ origins: PAGE_ACCESS_ORIGINS })
    expect(chromeApi.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      func: expect.any(Function),
      args: [MAX_CAPTURED_HTML_LENGTH],
    })
  })

  it('requests site access before anything else is awaited and stops when refused', async () => {
    const granted = createChromeMock()
    await capturePage(asChrome(granted), 7, 'https://example.com/')
    expect(granted.permissions.request.mock.invocationCallOrder[0])
      .toBeLessThan(granted.tabs.get.mock.invocationCallOrder[0])

    const refused = createChromeMock({ grant: false })
    expect(await captureError(capturePage(asChrome(refused), 7, 'https://example.com/'))).toBe('permissionDenied')
    expect(refused.scripting.executeScript).not.toHaveBeenCalled()
  })

  it('rejects pages Chrome does not allow scripting without asking for access', async () => {
    const chromeApi = createChromeMock()
    expect(await captureError(capturePage(asChrome(chromeApi), 7, 'chrome://settings/'))).toBe('unsupported')
    expect(chromeApi.permissions.request).not.toHaveBeenCalled()
  })

  it('requires the file URL opt-in for local files', async () => {
    const chromeApi = createChromeMock({ fileAccess: false })
    expect(await captureError(capturePage(asChrome(chromeApi), 7, 'file:///tmp/a.html'))).toBe('fileAccess')
    expect(chromeApi.scripting.executeScript).not.toHaveBeenCalled()
  })

  it('reports discarded tabs as not loaded', async () => {
    const chromeApi = createChromeMock({ tab: { id: 7, status: 'unloaded', discarded: true } })
    expect(await captureError(capturePage(asChrome(chromeApi), 7, 'https://example.com/'))).toBe('unloaded')
  })

  it('maps injection failures and malformed results to failed', async () => {
    const throwing = createChromeMock()
    throwing.scripting.executeScript.mockRejectedValueOnce(new Error('Cannot access contents'))
    expect(await captureError(capturePage(asChrome(throwing), 7, 'https://example.com/'))).toBe('failed')

    const malformed = createChromeMock({ results: [{ result: { html: 1 } }] })
    expect(await captureError(capturePage(asChrome(malformed), 7, 'https://example.com/'))).toBe('failed')
  })

  it('injects a self-contained reader that truncates very large pages', async () => {
    const chromeApi = createChromeMock()
    await capturePage(asChrome(chromeApi), 7, 'https://example.com/')
    const reader = chromeApi.scripting.executeScript.mock.calls[0][0].func as (max: number) => unknown

    document.title = 'Local doc'
    document.body.innerHTML = '<p>abcdefghij</p>'
    const snapshot = reader(20) as { html: string, truncated: boolean, title: string }
    expect(snapshot.html).toHaveLength(20)
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.title).toBe('Local doc')
  })
})
