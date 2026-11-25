import type { Translator } from '../i18n/i18n'
import type {
  BrowserTab,
  BrowserWindow,
  CustomTabGroup,
  DisplayCustomGroup,
  DisplayCustomGroupEntry,
} from '../types'
import { createDisplayTab, matchesTabQuery, resolveSafeFaviconUrl } from './tabs'

export const MAX_CUSTOM_GROUP_NAME_LENGTH = 40
export const MAX_SAVED_TAB_TITLE_LENGTH = 300
export const UNGROUPED_CUSTOM_GROUP_KEY = 'custom-ungrouped'

export function normalizeCustomGroupName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_GROUP_NAME_LENGTH)
}

export function addCustomGroup(
  groups: readonly CustomTabGroup[],
  id: string,
  name: string,
): CustomTabGroup[] {
  const normalizedName = normalizeCustomGroupName(name)
  if (!normalizedName || groups.some((group) => group.id === id)) {
    return [...groups]
  }
  return [...groups, { id, name: normalizedName, urls: [] }]
}

export function renameCustomGroup(
  groups: readonly CustomTabGroup[],
  id: string,
  name: string,
): CustomTabGroup[] {
  const normalizedName = normalizeCustomGroupName(name)
  return groups.map((group) =>
    group.id === id && normalizedName ? { ...group, name: normalizedName } : group,
  )
}

export function deleteCustomGroup(
  groups: readonly CustomTabGroup[],
  id: string,
): CustomTabGroup[] {
  return groups.filter((group) => group.id !== id)
}

/**
 * Lists groups in display order: pinned groups first, each part keeping the
 * user's saved order.
 */
export function orderCustomGroups(
  groups: readonly CustomTabGroup[],
): CustomTabGroup[] {
  return [
    ...groups.filter((group) => group.pinned),
    ...groups.filter((group) => !group.pinned),
  ]
}

/**
 * Swaps a group with its displayed neighbour of the same pin state, so a group
 * never crosses the pinned/unpinned boundary. Other moves leave the saved
 * order untouched.
 */
export function moveCustomGroup(
  groups: readonly CustomTabGroup[],
  id: string,
  offset: -1 | 1,
): CustomTabGroup[] {
  const ordered = orderCustomGroups(groups)
  const index = ordered.findIndex((group) => group.id === id)
  const target = ordered[index + offset]
  if (index < 0 || !target || Boolean(target.pinned) !== Boolean(ordered[index].pinned)) {
    return [...groups]
  }
  ;[ordered[index], ordered[index + offset]] = [target, ordered[index]]
  return ordered
}

/**
 * Moves a dragged group to the position of the group it was dropped on, in
 * display order. Dragging down lands after the target, dragging up before it.
 * Drops across the pinned/unpinned boundary leave the saved order untouched.
 */
export function reorderCustomGroup(
  groups: readonly CustomTabGroup[],
  sourceId: string,
  targetId: string,
): CustomTabGroup[] {
  const ordered = orderCustomGroups(groups)
  const sourceIndex = ordered.findIndex((group) => group.id === sourceId)
  const targetIndex = ordered.findIndex((group) => group.id === targetId)
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex === targetIndex ||
    Boolean(ordered[sourceIndex].pinned) !== Boolean(ordered[targetIndex].pinned)
  ) {
    return [...groups]
  }
  const [source] = ordered.splice(sourceIndex, 1)
  ordered.splice(targetIndex, 0, source)
  return ordered
}

/**
 * Flips a group's pin without reordering the saved list, so unpinning puts the
 * group back where it was unless the user moved groups in between.
 */
export function toggleCustomGroupPin(
  groups: readonly CustomTabGroup[],
  id: string,
): CustomTabGroup[] {
  return groups.map((group) =>
    group.id === id ? { ...group, pinned: !group.pinned } : group,
  )
}

/** Adds the URL to the group when absent, otherwise removes it. */
export function toggleCustomGroupUrl(
  groups: readonly CustomTabGroup[],
  id: string,
  url: string,
): CustomTabGroup[] {
  if (!url) return [...groups]
  return groups.map((group) => {
    if (group.id !== id) return group
    return group.urls.includes(url)
      ? withoutUrl(group, url)
      : { ...group, urls: [...group.urls, url] }
  })
}

/** Removes a saved URL, and its remembered title, from one group. */
export function removeCustomGroupUrl(
  groups: readonly CustomTabGroup[],
  id: string,
  url: string,
): CustomTabGroup[] {
  return groups.map((group) =>
    group.id === id && group.urls.includes(url) ? withoutUrl(group, url) : group,
  )
}

function withoutUrl(group: CustomTabGroup, url: string): CustomTabGroup {
  const { titles, ...rest } = group
  const next: CustomTabGroup = { ...rest, urls: group.urls.filter((candidate) => candidate !== url) }
  if (titles) {
    const remaining = Object.fromEntries(
      Object.entries(titles).filter(([titleUrl]) => titleUrl !== url),
    )
    if (Object.keys(remaining).length > 0) next.titles = remaining
  }
  return next
}

export function normalizeSavedTabTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').slice(0, MAX_SAVED_TAB_TITLE_LENGTH)
}

/**
 * Remembers the current title of every open tab whose URL a group saved, so
 * the entry keeps a readable name after the tab closes. Returns the input
 * array itself when nothing changed, letting callers skip a storage write.
 */
export function syncCustomGroupTitles(
  groups: CustomTabGroup[],
  windows: readonly BrowserWindow[],
): CustomTabGroup[] {
  const titleByUrl = new Map<string, string>()
  for (const tab of windows.flatMap((window) => window.tabs)) {
    const title = normalizeSavedTabTitle(tab.title)
    if (tab.url && title && !titleByUrl.has(tab.url)) titleByUrl.set(tab.url, title)
  }

  let changed = false
  const next = groups.map((group) => {
    let titles = group.titles
    for (const url of group.urls) {
      const title = titleByUrl.get(url)
      if (title && titles?.[url] !== title) {
        titles = { ...titles, [url]: title }
      }
    }
    if (titles === group.titles) return group
    changed = true
    return { ...group, titles }
  })
  return changed ? next : groups
}

/**
 * Finds the open tab for a saved URL: an exact URL match, preferring the
 * first window in the given order (callers put the current window first),
 * else the tab this popup opened for the URL while it is still loading or
 * after a redirect changed its address.
 */
export function findOpenTabForUrl(
  windows: readonly BrowserWindow[],
  url: string,
  linkedTabIds: ReadonlyMap<string, number> = new Map(),
): BrowserTab | undefined {
  const tabs = windows.flatMap((window) => window.tabs)
  const linkedTabId = linkedTabIds.get(url)
  return tabs.find((tab) => tab.url === url) ??
    (linkedTabId === undefined ? undefined : tabs.find((tab) => tab.id === linkedTabId))
}

/**
 * Lists the open tabs a group's close action closes: every tab showing one of
 * its saved URLs, plus tabs linked to them while loading.
 */
export function listCustomGroupOpenTabs(
  windows: readonly BrowserWindow[],
  group: CustomTabGroup,
  linkedTabIds: ReadonlyMap<string, number> = new Map(),
): BrowserTab[] {
  const urls = new Set(group.urls)
  const linkedIds = new Set(group.urls.flatMap((url) => {
    const tabId = linkedTabIds.get(url)
    return tabId === undefined ? [] : [tabId]
  }))
  return windows
    .flatMap((window) => window.tabs)
    .filter((tab) => urls.has(tab.url) || linkedIds.has(tab.id))
}

/**
 * Lists one open tab per distinct URL across windows, in window then tab
 * order. The tab picker offers these as the selectable members of a group.
 */
export function listSelectableTabs(windows: readonly BrowserWindow[]): BrowserTab[] {
  const seenUrls = new Set<string>()
  const tabs: BrowserTab[] = []
  for (const window of windows) {
    for (const tab of window.tabs) {
      if (!tab.url || seenUrls.has(tab.url)) continue
      seenUrls.add(tab.url)
      tabs.push(tab)
    }
  }
  return tabs
}

interface DisplayCustomGroupsOptions {
  /** Search text; entries and ungrouped tabs that do not match are left out. */
  query?: string
  /** Tabs this popup opened for saved URLs, by URL. */
  linkedTabIds?: ReadonlyMap<string, number>
}

/**
 * Builds the custom-group view. Every saved URL is one row, in saved order
 * with pinned tabs first: an open tab when one shows the URL, otherwise a
 * "not open" entry the user can reopen. Open tabs in no group are collected
 * in a trailing "ungrouped" section. `windows` must list every open tab with
 * the current window first; the search query filters rows here.
 */
export function createDisplayCustomGroups(
  windows: readonly BrowserWindow[],
  groups: readonly CustomTabGroup[],
  globalMasked: boolean,
  overrides: ReadonlyMap<number, boolean>,
  t: Translator,
  pinnedTabIds: ReadonlySet<number> = new Set(),
  { query = '', linkedTabIds = new Map() }: DisplayCustomGroupsOptions = {},
): DisplayCustomGroup[] {
  const tabs = windows.flatMap((window) => window.tabs)
  const groupedTabIds = new Set<number>()

  function toDisplayGroup(
    key: string,
    label: string,
    rows: DisplayCustomGroupEntry[],
    savedUrlCount: number,
    pinned: boolean,
  ): DisplayCustomGroup {
    const entries = rows
      .map((entry, originalIndex) => ({ entry, originalIndex }))
      .sort((left, right) => {
        const leftPinned = left.entry.tab ? pinnedTabIds.has(left.entry.tab.id) : false
        const rightPinned = right.entry.tab ? pinnedTabIds.has(right.entry.tab.id) : false
        return leftPinned === rightPinned
          ? left.originalIndex - right.originalIndex
          : leftPinned ? -1 : 1
      })
      .map(({ entry }) => entry)
    const displayTabs = entries.flatMap((entry) => entry.tab ? [entry.tab] : [])

    return {
      key,
      label,
      entries,
      tabs: displayTabs,
      allMasked: displayTabs.length > 0 && displayTabs.every((tab) => tab.masked),
      savedUrlCount,
      pinned,
    }
  }

  const orderedGroups = orderCustomGroups(groups)
  const displayGroups = orderedGroups.map((group) => {
    const rows = group.urls.flatMap((url): DisplayCustomGroupEntry[] => {
      const tab = findOpenTabForUrl(windows, url, linkedTabIds)
      if (tab) {
        groupedTabIds.add(tab.id)
        return matchesTabQuery(tab.title, tab.url, query)
          ? [{ url, tab: createDisplayTab(tab, globalMasked, overrides, t) }]
          : []
      }
      const title = group.titles?.[url] ?? ''
      if (!matchesTabQuery(title, url, query)) return []
      return [{
        url,
        saved: {
          url,
          masked: globalMasked,
          displayTitle: globalMasked ? t('informationHidden') : title || url,
          displayUrl: globalMasked ? '' : url,
          displayFavIconUrl: globalMasked ? undefined : resolveSafeFaviconUrl(undefined, url),
        },
      }]
    })
    return toDisplayGroup(group.id, group.name, rows, group.urls.length, Boolean(group.pinned))
  })
  const groupedUrls = new Set(groups.flatMap((group) => group.urls))
  const ungroupedRows = tabs
    .filter((tab) =>
      !groupedUrls.has(tab.url) &&
      !groupedTabIds.has(tab.id) &&
      matchesTabQuery(tab.title, tab.url, query),
    )
    .map((tab): DisplayCustomGroupEntry => ({
      url: tab.url,
      tab: createDisplayTab(tab, globalMasked, overrides, t),
    }))

  return ungroupedRows.length > 0
    ? [
        ...displayGroups,
        toDisplayGroup(UNGROUPED_CUSTOM_GROUP_KEY, t('ungroupedTabs'), ungroupedRows, 0, false),
      ]
    : displayGroups
}
