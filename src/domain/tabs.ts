import { getDomain } from 'tldts'
import type { Translator } from '../i18n/i18n'
import type {
  BrowserTab,
  BrowserWindow,
  DisplayDomainGroup,
  DisplayTab,
  DisplayWindow,
  TabFilter,
} from '../types'

const LOCAL_FAVICON_PATH = '/_favicon/'
const FAVICON_SIZE = 32
const SAFE_INLINE_FAVICON_PATTERN =
  /^data:image\/(?:png|gif|jpe?g|webp|x-icon|vnd\.microsoft\.icon);base64,[a-z0-9+/]+={0,2}$/i

const domainGroupIdentityRegistry = new Map<string, string>()
let nextDomainGroupIdentity = 1

function getOpaqueDomainGroupIdentity(domainKey: string): string {
  const existingIdentity = domainGroupIdentityRegistry.get(domainKey)
  if (existingIdentity) {
    return existingIdentity
  }

  const identity = `domain-group-${nextDomainGroupIdentity++}`
  domainGroupIdentityRegistry.set(domainKey, identity)
  return identity
}

function isSafePageUrl(pageUrl: string): boolean {
  try {
    const { protocol } = new URL(pageUrl)
    return ['http:', 'https:', 'chrome:', 'chrome-extension:', 'file:', 'ftp:'].includes(protocol)
  } catch {
    return false
  }
}

export function isSafeFaviconUrl(faviconUrl?: string): faviconUrl is string {
  if (!faviconUrl) {
    return false
  }

  if (SAFE_INLINE_FAVICON_PATTERN.test(faviconUrl)) {
    return true
  }

  if (!faviconUrl.startsWith(`${LOCAL_FAVICON_PATH}?`)) {
    return false
  }

  const query = new URLSearchParams(faviconUrl.slice(LOCAL_FAVICON_PATH.length + 1))
  const pageUrl = query.get('pageUrl')

  return (
    query.size === 2 &&
    query.get('size') === String(FAVICON_SIZE) &&
    pageUrl !== null &&
    isSafePageUrl(pageUrl)
  )
}

export function resolveSafeFaviconUrl(
  faviconUrl: string | undefined,
  pageUrl: string,
): string | undefined {
  if (faviconUrl && SAFE_INLINE_FAVICON_PATTERN.test(faviconUrl)) {
    return faviconUrl
  }

  if (!isSafePageUrl(pageUrl)) {
    return undefined
  }

  return `${LOCAL_FAVICON_PATH}?pageUrl=${encodeURIComponent(pageUrl)}&size=${FAVICON_SIZE}`
}

interface FilterWindowsOptions {
  query: string
  filter: TabFilter
  focusedWindowId: number
  favoriteUrls?: ReadonlySet<string>
}

export function sortWindowsCurrentFirst(
  windows: BrowserWindow[],
  focusedWindowId: number,
): BrowserWindow[] {
  return windows
    .map((window, originalIndex) => ({ window, originalIndex }))
    .sort((left, right) => {
      const leftIsFocused = left.window.id === focusedWindowId
      const rightIsFocused = right.window.id === focusedWindowId

      if (leftIsFocused !== rightIsFocused) {
        return leftIsFocused ? -1 : 1
      }

      return left.originalIndex - right.originalIndex
    })
    .map(({ window }) => window)
}

export function filterWindows(
  windows: BrowserWindow[],
  { query, filter, focusedWindowId, favoriteUrls = new Set() }: FilterWindowsOptions,
): BrowserWindow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return windows.flatMap((window) => {
    if (filter === 'current-window' && window.id !== focusedWindowId) {
      return []
    }

    const tabs = window.tabs.filter((tab) => {
      if (filter === 'active' && !tab.active) {
        return false
      }

      if (filter === 'favorites' && (tab.url.length === 0 || !favoriteUrls.has(tab.url))) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return (
        tab.title.toLocaleLowerCase().includes(normalizedQuery) ||
        tab.url.toLocaleLowerCase().includes(normalizedQuery)
      )
    })

    return tabs.length > 0 ? [{ ...window, tabs: [...tabs] }] : []
  })
}


/**
 * Returns every later tab whose non-empty URL exactly matches an earlier tab.
 * Input order defines which tab is retained and is never mutated.
 */
export function findDuplicateTabIds(tabs: readonly BrowserTab[]): number[] {
  const seenUrls = new Set<string>()
  const duplicateIds: number[] = []

  for (const tab of tabs) {
    if (tab.url.length === 0) {
      continue
    }

    if (seenUrls.has(tab.url)) {
      duplicateIds.push(tab.id)
    } else {
      seenUrls.add(tab.url)
    }
  }

  return duplicateIds
}

/**
 * Creates a stable native-tab order that makes equal registrable-domain groups
 * contiguous. Domain groups and tabs within each group retain first-seen order.
 */
export function createDomainSortedTabIds(
  tabs: readonly BrowserTab[],
): number[] {
  const groups = new Map<string, number[]>()

  for (const tab of tabs) {
    const domainKey = getTabDomainGroupKey(tab.url)
    const group = groups.get(domainKey)
    if (group) {
      group.push(tab.id)
    } else {
      groups.set(domainKey, [tab.id])
    }
  }

  return [...groups.values()].flat()
}

export function resolveMasked(
  globalMasked: boolean,
  overrides: ReadonlyMap<number, boolean>,
  tabId: number,
): boolean {
  return overrides.get(tabId) ?? globalMasked
}

function createDisplayTab(
  tab: BrowserTab,
  globalMasked: boolean,
  overrides: ReadonlyMap<number, boolean>,
  t: Translator,
): DisplayTab {
  const masked = resolveMasked(globalMasked, overrides, tab.id)

  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    active: tab.active,
    masked,
    displayTitle: masked ? t('informationHidden') : tab.title,
    displayUrl: masked ? '' : tab.url,
    displayFavIconUrl: masked
      ? undefined
      : resolveSafeFaviconUrl(tab.favIconUrl, tab.url),
  }
}

function normalizeHostname(hostname: string): string {
  const normalized = hostname.toLocaleLowerCase()
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized
}

export function getTabDomainGroupKey(tabUrl: string): string {
  try {
    const url = new URL(tabUrl)
    const scheme = url.protocol.slice(0, -1).toLocaleLowerCase()
    const hostname = normalizeHostname(url.hostname)

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return (
        getDomain(hostname, { allowPrivateDomains: true }) ??
        (hostname || 'other')
      )
    }

    return hostname ? `${scheme}://${hostname}` : `${scheme}://`
  } catch {
    return 'other'
  }
}

export function createDisplayDomainGroups(
  windows: BrowserWindow[],
  globalMasked: boolean,
  overrides: ReadonlyMap<number, boolean>,
  t: Translator,
  pinnedTabIds: ReadonlySet<number> = new Set(),
  pinnedDomainKeys: ReadonlySet<string> = new Set(),
): DisplayDomainGroup[] {
  const groups = new Map<string, BrowserTab[]>()

  for (const window of windows) {
    for (const tab of window.tabs) {
      const domainKey = getTabDomainGroupKey(tab.url)
      const tabs = groups.get(domainKey)
      if (tabs) {
        tabs.push(tab)
      } else {
        groups.set(domainKey, [tab])
      }
    }
  }

  return [...groups.entries()]
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      const leftPinned = pinnedDomainKeys.has(left.entry[0])
      const rightPinned = pinnedDomainKeys.has(right.entry[0])
      return leftPinned === rightPinned
        ? left.originalIndex - right.originalIndex
        : leftPinned ? -1 : 1
    })
    .map(({ entry: [domainKey, tabs] }, index) => {
    const displayTabs = tabs
      .map((tab, originalIndex) => ({ tab, originalIndex }))
      .sort((left, right) => {
        const leftPinned = pinnedTabIds.has(left.tab.id)
        const rightPinned = pinnedTabIds.has(right.tab.id)
        return leftPinned === rightPinned
          ? left.originalIndex - right.originalIndex
          : leftPinned ? -1 : 1
      })
      .map(({ tab }) =>
      createDisplayTab(tab, globalMasked, overrides, t),
    )
    const allTabsMasked = displayTabs.every((tab) => tab.masked)

    return {
      key: getOpaqueDomainGroupIdentity(domainKey),
      label: allTabsMasked
        ? t('maskedDomainGroup', { number: index + 1 })
        : domainKey === 'other'
          ? t('otherPages')
          : domainKey,
      tabs: displayTabs,
      allMasked: allTabsMasked,
    }
  })
}

export interface DisplayWindowsPresentationContext {
  focusedWindowId: number
  sortedWindowIds: readonly number[]
}

export function createDisplayWindowsPresentationContext(
  allWindows: BrowserWindow[],
  focusedWindowId: number,
): DisplayWindowsPresentationContext {
  return {
    focusedWindowId,
    sortedWindowIds: sortWindowsCurrentFirst(allWindows, focusedWindowId).map(
      (window) => window.id,
    ),
  }
}

export function createDisplayWindows(
  windows: BrowserWindow[],
  globalMasked: boolean,
  overrides: ReadonlyMap<number, boolean>,
  presentationContext: DisplayWindowsPresentationContext,
  t: Translator,
  pinnedTabIds: ReadonlySet<number> = new Set(),
): DisplayWindow[] {
  const { focusedWindowId, sortedWindowIds } = presentationContext
  const defaultSortedWindows = sortWindowsCurrentFirst(windows, focusedWindowId)
  const windowOrder = new Map(
    sortedWindowIds.map((windowId, index) => [windowId, index]),
  )
  const sortedWindows = defaultSortedWindows
    .map((window, defaultIndex) => ({ window, defaultIndex }))
    .sort((left, right) => {
      const leftIndex = windowOrder.get(left.window.id)
      const rightIndex = windowOrder.get(right.window.id)

      if (leftIndex !== undefined && rightIndex !== undefined) {
        return leftIndex - rightIndex
      }

      if (leftIndex !== undefined) {
        return -1
      }

      if (rightIndex !== undefined) {
        return 1
      }

      return left.defaultIndex - right.defaultIndex
    })
    .map(({ window }) => window)

  return sortedWindows.map((window, windowIndex) => {
    const originalWindowIndex = windowOrder.get(window.id)
    const labelIndex = originalWindowIndex ?? windowIndex

    return {
      id: window.id,
      focused: window.focused,
      label: window.id === focusedWindowId
        ? t('currentWindow')
        : t('numberedWindow', { number: labelIndex + 1 }),
      tabs: window.tabs
        .map((tab, originalIndex) => ({ tab, originalIndex }))
        .sort((left, right) => {
          const leftPinned = pinnedTabIds.has(left.tab.id)
          const rightPinned = pinnedTabIds.has(right.tab.id)
          return leftPinned === rightPinned
            ? left.originalIndex - right.originalIndex
            : leftPinned ? -1 : 1
        })
        .map(({ tab }) => createDisplayTab(tab, globalMasked, overrides, t)),
    }
  })
}
