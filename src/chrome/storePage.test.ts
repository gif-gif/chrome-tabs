import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORE_PAGE_URL, openStorePage } from './storePage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('STORE_PAGE_URL', () => {
  it('points at the published Chrome Web Store listing', () => {
    expect(STORE_PAGE_URL).toBe('https://chromewebstore.google.com/detail/tab-manager/jnlddbkjimakfiglopimemjlabocnhag')
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
