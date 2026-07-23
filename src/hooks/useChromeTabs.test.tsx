import { StrictMode, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import { useChromeTabs } from './useChromeTabs'
import type { BrowserWindow, ChromeTabsApi } from '../types'

const QUERY_ERROR_MESSAGE = 'queryError'
const SUBSCRIPTION_ERROR_MESSAGE = 'subscriptionError'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

function createApi(
  queryWindows: ChromeTabsApi['queryWindows'] = vi.fn(() =>
    Promise.resolve([]),
  ),
  subscribe: ChromeTabsApi['subscribe'] = vi.fn<
    ChromeTabsApi['subscribe']
  >(() => vi.fn()),
): ChromeTabsApi & {
  queryWindows: MockedFunction<ChromeTabsApi['queryWindows']>
  subscribe: MockedFunction<ChromeTabsApi['subscribe']>
} {
  return {
    queryWindows: queryWindows as MockedFunction<ChromeTabsApi['queryWindows']>,
    subscribe: subscribe as MockedFunction<ChromeTabsApi['subscribe']>,
    activateTab: vi.fn(() => Promise.resolve()),
    closeTab: vi.fn(() => Promise.resolve()),
    closeSidePanel: vi.fn(() => Promise.resolve()),
  }
}

const firstWindows: BrowserWindow[] = [
  {
    id: 10,
    focused: true,
    tabs: [
      {
        id: 101,
        windowId: 10,
        index: 0,
        active: true,
        title: 'First tab',
        url: 'https://example.com/first',
      },
    ],
  },
]

const secondWindows: BrowserWindow[] = [
  {
    id: 20,
    focused: true,
    tabs: [
      {
        id: 201,
        windowId: 20,
        index: 0,
        active: true,
        title: 'Second tab',
        url: 'https://example.com/second',
      },
    ],
  },
]

describe('useChromeTabs', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads windows and derives the focused window id', async () => {
    const query = deferred<BrowserWindow[]>()
    const api = createApi(vi.fn(() => query.promise))

    const { result } = renderHook(() => useChromeTabs(api))

    expect(result.current.loading).toBe(true)
    expect(result.current.windows).toEqual([])
    expect(api.queryWindows).toHaveBeenCalledOnce()

    await act(async () => {
      query.resolve(firstWindows)
      await query.promise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.windows).toEqual(firstWindows)
    expect(result.current.focusedWindowId).toBe(10)
    expect(result.current.error).toBeNull()
  })

  it('preserves the last good result and clears a query error on retry', async () => {
    const retry = deferred<BrowserWindow[]>()
    const query = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockResolvedValueOnce(firstWindows)
      .mockRejectedValueOnce(new Error('query failed with private details'))
      .mockReturnValueOnce(retry.promise)
    const api = createApi(query)
    const { result } = renderHook(() => useChromeTabs(api))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.windows).toEqual(firstWindows)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.windows).toEqual(firstWindows)
    expect(result.current.focusedWindowId).toBe(10)
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)

    let retryPromise!: Promise<void>
    act(() => {
      retryPromise = result.current.refresh()
    })
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)

    await act(async () => {
      retry.resolve(secondWindows)
      await retryPromise
    })

    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)
    expect(result.current.error).toBeNull()
  })

  it('uses a fixed query error that never exposes arbitrary private text', async () => {
    const rawPrivateMessage = [
      'query failed for "Confidential acquisition roadmap"',
      'private.internal.example/path?token=SECRET_VALUE',
      'chrome-extension://abcdefghijklmnop/private.html',
      'data:text/plain,private-payload',
      'blob:https://private.example/secret-id',
    ].join(' ')
    const api = createApi(
      vi.fn(() => Promise.reject(new Error(rawPrivateMessage))),
    )
    const { result } = renderHook(() => useChromeTabs(api))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)
    expect(result.current.error).not.toContain('Confidential acquisition roadmap')
    expect(result.current.error).not.toContain('private.internal.example')
    expect(result.current.error).not.toContain('chrome-extension:')
    expect(result.current.error).not.toContain('data:')
    expect(result.current.error).not.toContain('blob:')
  })

  it('preserves last-good data after an event refresh failure and recovers on retry', async () => {
    vi.useFakeTimers()
    const query = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockResolvedValueOnce(firstWindows)
      .mockRejectedValueOnce(new Error('event exposed private.example'))
      .mockResolvedValueOnce(secondWindows)
    const api = createApi(query)
    const { result } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.windows).toEqual(firstWindows)

    const listener = api.subscribe.mock.calls[0][0] as () => void
    act(() => listener())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40)
    })

    expect(result.current.windows).toEqual(firstWindows)
    expect(result.current.focusedWindowId).toBe(10)
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)
    expect(result.current.error).toBeNull()
  })

  it('automatically retries a failed query and recovers without another event', async () => {
    vi.useFakeTimers()
    const api = createApi(
      vi
        .fn<ChromeTabsApi['queryWindows']>()
        .mockRejectedValueOnce(new Error('transient private failure'))
        .mockResolvedValueOnce(firstWindows),
    )
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)
    expect(api.queryWindows).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(api.queryWindows).toHaveBeenCalledTimes(2)
    expect(result.current.windows).toEqual(firstWindows)
    expect(result.current.focusedWindowId).toBe(10)
    expect(result.current.error).toBeNull()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the query error visible while a background refresh is in flight', async () => {
    vi.useFakeTimers()
    const backgroundRefresh = deferred<BrowserWindow[]>()
    const api = createApi(
      vi
        .fn<ChromeTabsApi['queryWindows']>()
        .mockRejectedValueOnce(new Error('transient private failure'))
        .mockReturnValueOnce(backgroundRefresh.promise),
    )
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)

    const listener = api.subscribe.mock.calls[0][0] as () => void
    act(() => listener())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40)
    })

    expect(api.queryWindows).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)

    await act(async () => {
      backgroundRefresh.resolve(secondWindows)
      await backgroundRefresh.promise
    })
    expect(result.current.error).toBeNull()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops automatic retries after the bounded retry budget is exhausted', async () => {
    vi.useFakeTimers()
    const api = createApi(
      vi.fn(() => Promise.reject(new Error('persistent private failure'))),
    )
    const { unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
      await vi.runAllTimersAsync()
    })

    expect(api.queryWindows).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(0)

    unmount()
  })

  it('cancels an automatic retry when the hook unmounts', async () => {
    vi.useFakeTimers()
    const api = createApi(
      vi.fn(() => Promise.reject(new Error('persistent private failure'))),
    )
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).toBe(QUERY_ERROR_MESSAGE)
    expect(api.queryWindows).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()
    expect(vi.getTimerCount()).toBe(0)

    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(api.queryWindows).toHaveBeenCalledOnce()
  })

  it('coalesces bursty events into one refresh after 40 ms', async () => {
    vi.useFakeTimers()
    const api = createApi(vi.fn(() => Promise.resolve(firstWindows)))
    const { result } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.windows).toEqual(firstWindows)
    api.queryWindows.mockClear()

    const listener = api.subscribe.mock.calls[0][0] as () => void
    act(() => {
      listener()
      vi.advanceTimersByTime(30)
      listener()
      listener()
    })

    expect(api.queryWindows).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(39)
    })
    expect(api.queryWindows).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(api.queryWindows).toHaveBeenCalledOnce()
  })

  it('cancels a queued event refresh when a manual refresh starts', async () => {
    vi.useFakeTimers()
    const query = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockResolvedValueOnce(firstWindows)
      .mockResolvedValueOnce(secondWindows)
      .mockRejectedValueOnce(new Error('stale queued event failure'))
    const api = createApi(query)
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.windows).toEqual(firstWindows)

    const listener = api.subscribe.mock.calls[0][0] as () => void
    act(() => listener())

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)
    expect(result.current.error).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40)
    })

    expect(api.queryWindows).toHaveBeenCalledTimes(2)
    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.error).toBeNull()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a queued event refresh and cleans up once on unmount', async () => {
    vi.useFakeTimers()
    const cleanup = vi.fn()
    const api = createApi(
      vi.fn(() => Promise.resolve(firstWindows)),
      vi.fn(() => cleanup),
    )
    const { unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    api.queryWindows.mockClear()

    const listener = api.subscribe.mock.calls[0][0] as () => void
    listener()
    unmount()
    unmount()
    vi.advanceTimersByTime(40)

    expect(api.queryWindows).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('does not let an older query overwrite a newer refresh result', async () => {
    const older = deferred<BrowserWindow[]>()
    const newer = deferred<BrowserWindow[]>()
    const query = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
    const api = createApi(query)
    const { result } = renderHook(() => useChromeTabs(api))

    let refreshPromise!: Promise<void>
    act(() => {
      refreshPromise = result.current.refresh()
    })

    await act(async () => {
      newer.resolve(secondWindows)
      await refreshPromise
    })
    expect(result.current.windows).toEqual(secondWindows)

    await act(async () => {
      older.resolve(firstWindows)
      await older.promise
    })

    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)
  })

  it('automatically retries an initial subscription failure and handles events after recovery', async () => {
    vi.useFakeTimers()
    let listener!: () => void
    const cleanup = vi.fn()
    const subscribe = vi
      .fn<ChromeTabsApi['subscribe']>()
      .mockImplementationOnce(() => {
        throw new Error('initial subscription failure with private details')
      })
      .mockImplementationOnce((nextListener) => {
        listener = nextListener
        return cleanup
      })
    const query = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockResolvedValueOnce(firstWindows)
      .mockResolvedValueOnce(secondWindows)
    const api = createApi(query, subscribe)
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).toBe(SUBSCRIPTION_ERROR_MESSAGE)
    expect(api.subscribe).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(api.subscribe).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()

    act(() => listener())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40)
    })
    expect(api.queryWindows).toHaveBeenCalledTimes(2)
    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)

    unmount()
    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses a manual refresh to retry a failed subscription immediately', async () => {
    vi.useFakeTimers()
    const cleanup = vi.fn()
    const query = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockResolvedValueOnce(firstWindows)
      .mockResolvedValueOnce(secondWindows)
    const subscribe = vi
      .fn<ChromeTabsApi['subscribe']>()
      .mockImplementationOnce(() => {
        throw new Error(
          'subscription failed for "Private title" private.example data:text/plain,secret',
        )
      })
      .mockImplementationOnce(() => cleanup)
    const api = createApi(query, subscribe)
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).toBe(SUBSCRIPTION_ERROR_MESSAGE)
    expect(result.current.error).not.toContain('Private title')
    expect(result.current.error).not.toContain('private.example')
    expect(result.current.error).not.toContain('data:')

    await act(async () => {
      await result.current.refresh()
    })

    expect(api.subscribe).toHaveBeenCalledTimes(2)
    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)
    expect(result.current.error).toBeNull()
    expect(api.queryWindows).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)

    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('stops automatic subscription retries after the bounded retry budget', async () => {
    vi.useFakeTimers()
    const subscribe = vi.fn<ChromeTabsApi['subscribe']>(() => {
      throw new Error('persistent subscription failure with private details')
    })
    const api = createApi(vi.fn(() => Promise.resolve(firstWindows)), subscribe)
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
      await vi.runAllTimersAsync()
    })

    expect(api.subscribe).toHaveBeenCalledTimes(4)
    expect(result.current.error).toBe(SUBSCRIPTION_ERROR_MESSAGE)
    expect(vi.getTimerCount()).toBe(0)

    unmount()
  })

  it('cancels a pending subscription retry on unmount', async () => {
    vi.useFakeTimers()
    const subscribe = vi.fn<ChromeTabsApi['subscribe']>(() => {
      throw new Error('persistent subscription failure with private details')
    })
    const api = createApi(vi.fn(() => Promise.resolve(firstWindows)), subscribe)
    const { unmount } = renderHook(() => useChromeTabs(api))

    await act(async () => {
      await Promise.resolve()
    })
    expect(api.subscribe).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()
    unmount()
    expect(vi.getTimerCount()).toBe(0)

    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(api.subscribe).toHaveBeenCalledOnce()
  })

  it('replaces the subscription and query source when the API identity changes', async () => {
    let activeFirstSubscriptions = 0
    let activeSecondSubscriptions = 0
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const firstApi = createApi(
      vi.fn(() => Promise.resolve(firstWindows)),
      vi.fn(() => {
        activeFirstSubscriptions += 1
        let cleaned = false
        return () => {
          if (cleaned) return
          cleaned = true
          activeFirstSubscriptions -= 1
          firstCleanup()
        }
      }),
    )
    const secondApi = createApi(
      vi.fn(() => Promise.resolve(secondWindows)),
      vi.fn(() => {
        activeSecondSubscriptions += 1
        let cleaned = false
        return () => {
          if (cleaned) return
          cleaned = true
          activeSecondSubscriptions -= 1
          secondCleanup()
        }
      }),
    )
    const { result, rerender, unmount } = renderHook(
      ({ api }: { api: ChromeTabsApi }) => useChromeTabs(api),
      { initialProps: { api: firstApi } },
    )

    await waitFor(() => expect(result.current.windows).toEqual(firstWindows))
    expect(activeFirstSubscriptions).toBe(1)

    rerender({ api: secondApi })

    await waitFor(() => expect(result.current.windows).toEqual(secondWindows))
    expect(activeFirstSubscriptions).toBe(0)
    expect(activeSecondSubscriptions).toBe(1)
    expect(firstCleanup).toHaveBeenCalledOnce()

    unmount()
    expect(activeSecondSubscriptions).toBe(0)
    expect(secondCleanup).toHaveBeenCalledOnce()
  })

  it('ignores a retained old subscription listener after the API changes', async () => {
    vi.useFakeTimers()
    let oldListener!: () => void
    const firstApi = createApi(
      vi.fn(() => Promise.resolve(firstWindows)),
      vi.fn((listener) => {
        oldListener = listener
        return vi.fn()
      }),
    )
    const secondApi = createApi(
      vi.fn(() => Promise.resolve(secondWindows)),
    )
    const { result, rerender } = renderHook(
      ({ api }: { api: ChromeTabsApi }) => useChromeTabs(api),
      { initialProps: { api: firstApi } },
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.windows).toEqual(firstWindows)

    rerender({ api: secondApi })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)

    firstApi.queryWindows.mockClear()
    secondApi.queryWindows.mockClear()

    act(() => oldListener())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40)
    })

    expect(firstApi.queryWindows).not.toHaveBeenCalled()
    expect(secondApi.queryWindows).not.toHaveBeenCalled()
    expect(result.current.windows).toEqual(secondWindows)
    expect(result.current.focusedWindowId).toBe(20)
  })

  it('keeps one active subscription through a StrictMode lifecycle', async () => {
    let activeSubscriptions = 0
    const api = createApi(
      vi.fn(() => Promise.resolve(firstWindows)),
      vi.fn(() => {
        activeSubscriptions += 1
        let cleaned = false
        return () => {
          if (cleaned) return
          cleaned = true
          activeSubscriptions -= 1
        }
      }),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    )
    const { result, unmount } = renderHook(() => useChromeTabs(api), { wrapper })

    await waitFor(() => expect(result.current.windows).toEqual(firstWindows))
    expect(activeSubscriptions).toBe(1)

    unmount()
    expect(activeSubscriptions).toBe(0)
  })

  it('does not update state after unmount when a pending query resolves', async () => {
    const query = deferred<BrowserWindow[]>()
    const api = createApi(vi.fn(() => query.promise))
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    unmount()

    await act(async () => {
      query.resolve(firstWindows)
      await query.promise
    })

    expect(result.current.windows).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('does not update state after unmount when a pending query rejects', async () => {
    const query = deferred<BrowserWindow[]>()
    const api = createApi(vi.fn(() => query.promise))
    const { result, unmount } = renderHook(() => useChromeTabs(api))

    unmount()

    await act(async () => {
      query.reject(new Error('private.example "Private title"'))
      await Promise.resolve()
    })

    expect(result.current.windows).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
