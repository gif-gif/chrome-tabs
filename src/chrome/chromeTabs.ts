import type { BrowserTab, BrowserWindow, ChromeTabsApi } from '../types'
import { capturePage } from './pageCapture'

const CHROME_API_UNAVAILABLE_MESSAGE =
  'Chrome extension API is unavailable.'

const unavailableChromeTabsApi: ChromeTabsApi = {
  queryWindows: async () => {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  },
  activateTab: async () => {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  },
  closeTab: async () => {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  },
  openTabInNewWindow: async () => {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  },
  moveTabs: async () => {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  },
  capturePage: async () => {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  },
  subscribe: () => () => undefined,
}

type ChromeEvent = {
  addListener(listener: (...args: never[]) => void): void
  removeListener(listener: (...args: never[]) => void): void
}

type UnknownRecord = Record<string, unknown>

function isChromeEvent(value: unknown): value is ChromeEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ChromeEvent).addListener === 'function' &&
    typeof (value as ChromeEvent).removeListener === 'function'
  )
}

function getRequiredEvents(chromeApi: typeof chrome): ChromeEvent[] {
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

function assertChromeApi(
  chromeApi: typeof chrome | undefined,
): asserts chromeApi is typeof chrome {
  if (
    !chromeApi?.windows ||
    typeof chromeApi.windows.getAll !== 'function' ||
    typeof chromeApi.windows.update !== 'function' ||
    typeof chromeApi.windows.create !== 'function' ||
    !chromeApi.tabs ||
    typeof chromeApi.tabs.update !== 'function' ||
    typeof chromeApi.tabs.remove !== 'function' ||
    typeof chromeApi.tabs.move !== 'function' ||
    !getRequiredEvents(chromeApi).every(isChromeEvent)
  ) {
    throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function normalizeTab(
  value: unknown,
  containingWindowId: number,
  fallbackIndex: number,
): BrowserTab | null {
  if (!isRecord(value)) {
    return null
  }

  const { id, windowId } = value
  if (
    !isNonNegativeInteger(id) ||
    !isNonNegativeInteger(windowId) ||
    windowId !== containingWindowId
  ) {
    return null
  }

  const normalized: BrowserTab = {
    id,
    windowId,
    index: isNonNegativeInteger(value.index) ? value.index : fallbackIndex,
    active: value.active === true,
    title: typeof value.title === 'string' ? value.title : '',
    url: typeof value.url === 'string' ? value.url : '',
  }

  if (typeof value.favIconUrl === 'string' && value.favIconUrl.length > 0) {
    normalized.favIconUrl = value.favIconUrl
  }

  return normalized
}

function removeListeners(
  events: ChromeEvent[],
  listener: (...args: never[]) => void,
): unknown {
  let firstError: unknown

  for (const event of events) {
    try {
      event.removeListener(listener)
    } catch (error) {
      firstError ??= error
    }
  }

  return firstError
}

export function createChromeTabsApi(
  chromeApi: typeof chrome | undefined = globalThis.chrome,
): ChromeTabsApi {
  assertChromeApi(chromeApi)
  const events = getRequiredEvents(chromeApi)

  return {
    async queryWindows(): Promise<BrowserWindow[]> {
      const result: unknown = await chromeApi.windows.getAll({
        populate: true,
        windowTypes: ['normal'],
      })

      if (!Array.isArray(result)) {
        return []
      }

      // While the toolbar popup is open no browser window reports focused,
      // so fall back to the last focused normal window as the current one.
      let lastFocusedWindowId: number | undefined
      if (
        !result.some((value) => isRecord(value) && value.focused === true) &&
        typeof chromeApi.windows.getLastFocused === 'function'
      ) {
        try {
          const lastFocused: unknown = await chromeApi.windows.getLastFocused({ windowTypes: ['normal'] })
          if (isRecord(lastFocused) && isNonNegativeInteger(lastFocused.id)) {
            lastFocusedWindowId = lastFocused.id
          }
        } catch {
          // Without a last focused window the list simply has no current window.
        }
      }

      return result.flatMap((value) => {
        if (!isRecord(value) || !isNonNegativeInteger(value.id)) {
          return []
        }

        const containingWindowId = value.id
        const rawTabs = Array.isArray(value.tabs) ? value.tabs : []
        const tabs = rawTabs
          .map((tab, index) =>
            normalizeTab(tab, containingWindowId, index),
          )
          .filter((tab): tab is BrowserTab => tab !== null)
          .sort((left, right) => left.index - right.index)

        return [
          {
            id: value.id,
            focused: Boolean(value.focused) || value.id === lastFocusedWindowId,
            tabs,
          },
        ]
      })
    },

    async activateTab(tabId: number, windowId: number): Promise<void> {
      const tabActivation = chromeApi.tabs.update(tabId, { active: true })
      const windowFocus = chromeApi.windows.update(windowId, { focused: true })
      await Promise.all([tabActivation, windowFocus])
    },

    async closeTab(tabId: number): Promise<void> {
      await chromeApi.tabs.remove(tabId)
    },

    async openTabInNewWindow(tabId: number): Promise<void> {
      await chromeApi.windows.create({ tabId, focused: true })
    },

    async moveTabs(tabIds: number[], windowId: number): Promise<void> {
      if (tabIds.length === 0) {
        return
      }

      await chromeApi.tabs.move(tabIds, { windowId, index: 0 })
    },

    capturePage(tabId: number, url: string) {
      return capturePage(chromeApi, tabId, url)
    },

    subscribe(listener: () => void): () => void {
      const eventListener = () => listener()
      const registeredEvents: ChromeEvent[] = []

      try {
        for (const event of events) {
          event.addListener(eventListener)
          registeredEvents.push(event)
        }
      } catch (error) {
        removeListeners(registeredEvents, eventListener)
        throw error
      }

      let cleanedUp = false

      return () => {
        if (cleanedUp) {
          return
        }

        cleanedUp = true
        const removalError = removeListeners(registeredEvents, eventListener)
        if (removalError !== undefined) {
          throw removalError
        }
      }
    },
  }
}


/**
 * Creates the production adapter without allowing unavailable Chrome APIs to
 * crash the React tree during module initialization or render.
 */
export function createSafeChromeTabsApi(
  chromeApi: typeof chrome | undefined = globalThis.chrome,
): ChromeTabsApi {
  try {
    return createChromeTabsApi(chromeApi)
  } catch {
    return unavailableChromeTabsApi
  }
}
