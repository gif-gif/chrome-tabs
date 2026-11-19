import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStorePageUrl, openStorePage } from './storePage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getStorePageUrl', () => {
  it('builds the Chrome Web Store detail URL from the extension ID', () => {
    expect(getStorePageUrl('abcdefghijklmnop')).toBe('https://chromewebstore.google.com/detail/abcdefghijklmnop')
  })

  it('reads chrome.runtime.id by default', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'runtimeid' } })
    expect(getStorePageUrl()).toBe('https://chromewebstore.google.com/detail/runtimeid')
  })

  it('returns null without an extension ID', () => {
    expect(getStorePageUrl('')).toBeNull()
  })
})

describe('openStorePage', () => {
  it('opens the URL in a new tab and closes the popup', async () => {
    const create = vi.fn().mockResolvedValue({})
    const close = vi.fn()
    vi.stubGlobal('close', close)

    await openStorePage('https://chromewebstore.google.com/detail/x', { tabs: { create } } as unknown as typeof chrome)

    expect(create).toHaveBeenCalledWith({ url: 'https://chromewebstore.google.com/detail/x' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0])
  })
})
