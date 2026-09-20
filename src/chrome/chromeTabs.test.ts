import { describe, expect, it, vi } from 'vitest'
import { createChromeTabsApi, createSafeChromeTabsApi } from './chromeTabs'

const CHROME_API_UNAVAILABLE_MESSAGE = 'Chrome extension API is unavailable.'

function captureError(action: () => void): Error {
  let thrown: unknown

  try {
    action()
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  return thrown as Error
}

type EventListener = (...args: unknown[]) => void

function createEventMock() {
  const listeners = new Set<EventListener>()

  return {
    addListener: vi.fn((listener: EventListener) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: EventListener) => {
      listeners.delete(listener)
    }),
    emit: (...args: unknown[]) => {
      for (const listener of listeners) {
        listener(...args)
      }
    },
  }
}

function createChromeMock(windows: unknown = []) {
  return {
    tabs: {
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      move: vi.fn().mockResolvedValue(undefined),
      onCreated: createEventMock(),
      onUpdated: createEventMock(),
      onMoved: createEventMock(),
      onActivated: createEventMock(),
      onRemoved: createEventMock(),
      onAttached: createEventMock(),
      onDetached: createEventMock(),
      onReplaced: createEventMock(),
    },
    windows: {
      getAll: vi.fn().mockResolvedValue(windows),
      update: vi.fn().mockResolvedValue(undefined),
      onCreated: createEventMock(),
      onRemoved: createEventMock(),
      onFocusChanged: createEventMock(),
    },
  }
}

function getChromeEvents(chromeApi: ReturnType<typeof createChromeMock>) {
  return [
    chromeApi.tabs.onCreated,
    chromeApi.tabs.onUpdated,
    chromeApi.tabs.onMoved,
    chromeApi.tabs.onActivated,
    chromeApi.tabs.onRemoved,
    chromeApi.tabs.onAttached,
    chromeApi.tabs.onDetached,
    chromeApi.tabs.onReplaced,
    chromeApi.windows.onCreated,
    chromeApi.windows.onRemoved,
    chromeApi.windows.onFocusChanged,
  ]
}

describe('createChromeTabsApi queryWindows', () => {
  it('normalizes malformed Chrome data without mutating it', async () => {
    const chromeWindows = [
      {
        id: 10,
        focused: 1,
        tabs: [
          {
            id: 103,
            windowId: 10,
            index: 2,
            active: 0,
            title: undefined,
            url: null,
            favIconUrl: '',
          },
          {
            id: 102,
            windowId: 10,
            index: -1,
            active: 'yes',
            title: 123,
            url: { href: 'https://example.com/not-a-string' },
            favIconUrl: 42,
          },
          {
            id: 101,
            windowId: 10,
            index: 0,
            active: true,
            title: 'First tab',
            url: 'https://example.com/first',
            favIconUrl: 'https://example.com/favicon.ico',
          },
          {
            id: 0,
            windowId: 10,
            index: 3,
            active: false,
            title: 'Zero ID is valid',
            url: '',
          },
          { id: 104, windowId: 11, index: 4 },
          { id: undefined, windowId: 10, index: 5 },
          { id: Number.NaN, windowId: 10, index: 6 },
          { id: Number.POSITIVE_INFINITY, windowId: 10, index: 7 },
          { id: -1, windowId: 10, index: 8 },
          { id: 1.5, windowId: 10, index: 9 },
          { id: 105, windowId: undefined, index: 10 },
          { id: 106, windowId: Number.POSITIVE_INFINITY, index: 11 },
          { id: 107, windowId: -1, index: 12 },
          { id: 108, windowId: 10.5, index: 13 },
        ],
      },
      { id: undefined, focused: false, tabs: [] },
      { id: Number.NaN, focused: false, tabs: [] },
      { id: Number.POSITIVE_INFINITY, focused: false, tabs: [] },
      { id: -1, focused: false, tabs: [] },
      { id: 1.5, focused: false, tabs: [] },
      null,
      'not a window',
      { id: 20, focused: false, tabs: 'not an array' },
    ]
    const snapshot = structuredClone(chromeWindows)
    const chromeApi = createChromeMock(chromeWindows)

    const result = await createChromeTabsApi(
      chromeApi as unknown as typeof chrome,
    ).queryWindows()

    expect(chromeApi.windows.getAll).toHaveBeenCalledWith({
      populate: true,
      windowTypes: ['normal'],
    })
    expect(result).toEqual([
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
            favIconUrl: 'https://example.com/favicon.ico',
          },
          {
            id: 102,
            windowId: 10,
            index: 1,
            active: false,
            title: '',
            url: '',
          },
          {
            id: 103,
            windowId: 10,
            index: 2,
            active: false,
            title: '',
            url: '',
          },
          {
            id: 0,
            windowId: 10,
            index: 3,
            active: false,
            title: 'Zero ID is valid',
            url: '',
          },
        ],
      },
      { id: 20, focused: false, tabs: [] },
    ])
    expect(chromeWindows).toEqual(snapshot)
    expect(result[0]).not.toBe(chromeWindows[0])
    expect(result[0]?.tabs).not.toBe(
      (chromeWindows[0] as { tabs: unknown[] }).tabs,
    )
  })

  it('returns an empty list when windows.getAll resolves to a non-array value', async () => {
    const chromeApi = createChromeMock({ malformed: true })

    await expect(
      createChromeTabsApi(chromeApi as unknown as typeof chrome).queryWindows(),
    ).resolves.toEqual([])
  })

  it('throws the exact localized availability error when required Chrome APIs are absent', () => {
    const missingChromeError = captureError(() =>
      createChromeTabsApi(undefined as unknown as typeof chrome),
    )
    const incompleteChromeError = captureError(() =>
      createChromeTabsApi({ tabs: {}, windows: {} } as unknown as typeof chrome),
    )

    expect(missingChromeError.message).toBe(CHROME_API_UNAVAILABLE_MESSAGE)
    expect(incompleteChromeError.message).toBe(CHROME_API_UNAVAILABLE_MESSAGE)
  })

  it('uses globalThis.chrome when no API argument is provided', async () => {
    const originalChromeDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'chrome',
    )
    const chromeApi = createChromeMock([{ id: 20, focused: true, tabs: [] }])

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: chromeApi,
      writable: true,
    })

    try {
      await expect(createChromeTabsApi().queryWindows()).resolves.toEqual([
        { id: 20, focused: true, tabs: [] },
      ])
      expect(chromeApi.windows.getAll).toHaveBeenCalledWith({
        populate: true,
        windowTypes: ['normal'],
      })
    } finally {
      if (originalChromeDescriptor) {
        Object.defineProperty(globalThis, 'chrome', originalChromeDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'chrome')
      }
    }
  })

  it('propagates Promise rejection from windows.getAll', async () => {
    const chromeApi = createChromeMock()
    const error = new Error('query failed')
    chromeApi.windows.getAll.mockRejectedValueOnce(error)

    await expect(
      createChromeTabsApi(chromeApi as unknown as typeof chrome).queryWindows(),
    ).rejects.toBe(error)
  })
})

describe('createChromeTabsApi operations', () => {
  it('starts tab activation and window focus before awaiting either popup-sensitive operation', async () => {
    const chromeApi = createChromeMock()
    let resolveTabUpdate!: () => void
    let resolveWindowUpdate!: () => void
    chromeApi.tabs.update.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveTabUpdate = resolve
        }),
    )
    chromeApi.windows.update.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWindowUpdate = resolve
        }),
    )
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    const activation = api.activateTab(7, 20)

    expect(chromeApi.tabs.update).toHaveBeenCalledWith(7, { active: true })
    expect(chromeApi.windows.update).toHaveBeenCalledWith(20, { focused: true })

    resolveTabUpdate()
    resolveWindowUpdate()
    await activation
  })

  it('starts window focus even when tab activation rejects, then propagates the failure', async () => {
    const chromeApi = createChromeMock()
    const error = new Error('activation failed')
    chromeApi.tabs.update.mockRejectedValueOnce(error)
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    await expect(api.activateTab(7, 20)).rejects.toBe(error)
    expect(chromeApi.windows.update).toHaveBeenCalledWith(20, { focused: true })
  })

  it('propagates window focus errors while still starting tab activation', async () => {
    const chromeApi = createChromeMock()
    const error = new Error('focus failed')
    chromeApi.windows.update.mockRejectedValueOnce(error)
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    await expect(api.activateTab(7, 20)).rejects.toBe(error)
    expect(chromeApi.tabs.update).toHaveBeenCalledWith(7, { active: true })
    expect(chromeApi.windows.update).toHaveBeenCalledWith(20, { focused: true })
  })

  it('moves an ordered tab batch to the start of its existing window', async () => {
    const chromeApi = createChromeMock()
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    await api.moveTabs?.([7, 9, 8], 20)

    expect(chromeApi.tabs.move).toHaveBeenCalledWith(
      [7, 9, 8],
      { windowId: 20, index: 0 },
    )
  })

  it('skips empty move batches and propagates move errors', async () => {
    const chromeApi = createChromeMock()
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    await api.moveTabs?.([], 20)
    expect(chromeApi.tabs.move).not.toHaveBeenCalled()

    const error = new Error('move failed')
    chromeApi.tabs.move.mockRejectedValueOnce(error)
    await expect(api.moveTabs?.([7], 20)).rejects.toBe(error)
  })

  it('closes a tab and propagates removal errors', async () => {
    const chromeApi = createChromeMock()
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    await api.closeTab(7)
    expect(chromeApi.tabs.remove).toHaveBeenCalledWith(7)

    const error = new Error('remove failed')
    chromeApi.tabs.remove.mockRejectedValueOnce(error)
    await expect(api.closeTab(8)).rejects.toBe(error)
  })
})

describe('ChromeTabsApi surface', () => {
  it('does not expose side panel controls', () => {
    const chromeApi = createChromeMock()
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)
    const unavailableApi = createSafeChromeTabsApi(undefined)

    expect(api).not.toHaveProperty('closeSidePanel')
    expect(unavailableApi).not.toHaveProperty('closeSidePanel')
  })
})

describe('createChromeTabsApi subscribe', () => {
  it('registers one safe callback for every event and cleanup is idempotent', () => {
    const chromeApi = createChromeMock()
    const listener = vi.fn()
    const events = getChromeEvents(chromeApi)
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    const cleanup = api.subscribe(listener)
    const registeredCallbacks = events.map(
      (event) => event.addListener.mock.calls[0][0],
    )

    for (const event of events) {
      expect(event.addListener).toHaveBeenCalledTimes(1)
    }
    expect(new Set(registeredCallbacks)).toHaveLength(1)

    events[0].emit({ id: 7 })
    events[1].emit(7, { title: 'updated' }, { id: 7 })
    events[3].emit({ tabId: 7, windowId: 20 })
    events[10].emit(20)
    expect(listener).toHaveBeenCalledTimes(4)

    cleanup()
    cleanup()

    events.forEach((event, index) => {
      expect(event.removeListener).toHaveBeenCalledTimes(1)
      expect(event.removeListener).toHaveBeenCalledWith(
        registeredCallbacks[index],
      )
    })

    events[0].emit({ id: 8 })
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('rolls back partial registration and rethrows the addListener error', () => {
    const chromeApi = createChromeMock()
    const listener = vi.fn()
    const events = getChromeEvents(chromeApi)
    const error = new Error('registration failed')
    events[2].addListener.mockImplementationOnce(() => {
      throw error
    })
    const api = createChromeTabsApi(chromeApi as unknown as typeof chrome)

    expect(() => api.subscribe(listener)).toThrow(error)

    const registeredCallback = events[0].addListener.mock.calls[0][0]
    expect(events[1].addListener).toHaveBeenCalledWith(registeredCallback)
    expect(events[0].removeListener).toHaveBeenCalledWith(registeredCallback)
    expect(events[1].removeListener).toHaveBeenCalledWith(registeredCallback)
    expect(events[2].removeListener).not.toHaveBeenCalled()
    for (const event of events.slice(3)) {
      expect(event.addListener).not.toHaveBeenCalled()
    }

    events[0].emit({ id: 8 })
    events[1].emit(8, {}, {})
    expect(listener).not.toHaveBeenCalled()
  })

  it('throws the availability error when tabs.move is absent', () => {
    const chromeApi = createChromeMock()
    const incompleteApi = {
      ...chromeApi,
      tabs: { ...chromeApi.tabs, move: undefined },
    }

    const error = captureError(() =>
      createChromeTabsApi(incompleteApi as unknown as typeof chrome),
    )

    expect(error.message).toBe(CHROME_API_UNAVAILABLE_MESSAGE)
  })

  it('throws the availability error when a required event API is absent', () => {
    const chromeApi = createChromeMock()
    const incompleteApi = {
      ...chromeApi,
      tabs: { ...chromeApi.tabs, onReplaced: undefined },
    }

    const error = captureError(() =>
      createChromeTabsApi(incompleteApi as unknown as typeof chrome),
    )

    expect(error.message).toBe(CHROME_API_UNAVAILABLE_MESSAGE)
  })
})
