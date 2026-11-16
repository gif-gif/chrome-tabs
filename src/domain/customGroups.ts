import type { Translator } from '../i18n/i18n'
import type {
  BrowserTab,
  BrowserWindow,
  CustomTabGroup,
  DisplayCustomGroup,
} from '../types'
import { createDisplayTab } from './tabs'

export const MAX_CUSTOM_GROUP_NAME_LENGTH = 40
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

/** Swaps a group with its neighbour; moving past either end is a no-op. */
export function moveCustomGroup(
  groups: readonly CustomTabGroup[],
  id: string,
  offset: -1 | 1,
): CustomTabGroup[] {
  const index = groups.findIndex((group) => group.id === id)
  const targetIndex = index + offset
  if (index < 0 || targetIndex < 0 || targetIndex >= groups.length) {
    return [...groups]
  }
  const next = [...groups]
  ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
  return next
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
      ? { ...group, urls: group.urls.filter((candidate) => candidate !== url) }
      : { ...group, urls: [...group.urls, url] }
  })
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

/**
 * Builds the custom-group view. A tab appears in every group that saved its
 * URL; tabs in no group are collected in a trailing "ungrouped" section.
 */
export function createDisplayCustomGroups(
  windows: readonly BrowserWindow[],
  groups: readonly CustomTabGroup[],
  globalMasked: boolean,
  overrides: ReadonlyMap<number, boolean>,
  t: Translator,
  pinnedTabIds: ReadonlySet<number> = new Set(),
): DisplayCustomGroup[] {
  const tabs = windows.flatMap((window) => window.tabs)
  const groupedUrls = new Set(groups.flatMap((group) => group.urls))

  function toDisplayGroup(
    key: string,
    label: string,
    groupTabs: BrowserTab[],
    savedUrlCount: number,
  ): DisplayCustomGroup {
    const displayTabs = groupTabs
      .map((tab, originalIndex) => ({ tab, originalIndex }))
      .sort((left, right) => {
        const leftPinned = pinnedTabIds.has(left.tab.id)
        const rightPinned = pinnedTabIds.has(right.tab.id)
        return leftPinned === rightPinned
          ? left.originalIndex - right.originalIndex
          : leftPinned ? -1 : 1
      })
      .map(({ tab }) => createDisplayTab(tab, globalMasked, overrides, t))

    return {
      key,
      label,
      tabs: displayTabs,
      allMasked: displayTabs.length > 0 && displayTabs.every((tab) => tab.masked),
      savedUrlCount,
    }
  }

  const displayGroups = groups.map((group) => {
    const urls = new Set(group.urls)
    return toDisplayGroup(
      group.id,
      group.name,
      tabs.filter((tab) => urls.has(tab.url)),
      group.urls.length,
    )
  })
  const ungroupedTabs = tabs.filter((tab) => !groupedUrls.has(tab.url))

  return ungroupedTabs.length > 0
    ? [
        ...displayGroups,
        toDisplayGroup(UNGROUPED_CUSTOM_GROUP_KEY, t('ungroupedTabs'), ungroupedTabs, 0),
      ]
    : displayGroups
}
