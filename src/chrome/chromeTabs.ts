import type { BrowserTab, BrowserWindow, ChromeTabsApi } from '../types'

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
  closeSidePanel: async () => {
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
    !chromeApi.tabs ||
    typeof chromeApi.tabs.update !== 'function' ||
    typeof chromeApi.tabs.remove !== 'function' ||
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
            focused: Boolean(value.focused),
            tabs,
          },
        ]
      })
    },

    async activateTab(tabId: number, windowId: number): Promise<void> {
      await chromeApi.tabs.update(tabId, { active: true })
      await chromeApi.windows.update(windowId, { focused: true })
    },

    async closeTab(tabId: number): Promise<void> {
      await chromeApi.tabs.remove(tabId)
    },

    async closeSidePanel(windowId: number): Promise<void> {
      const sidePanel = chromeApi.sidePanel
      if (!sidePanel || typeof sidePanel.close !== 'function') {
        throw new Error(CHROME_API_UNAVAILABLE_MESSAGE)
      }

      await sidePanel.close({ windowId })
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
