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
    pinned: boolean,
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
      pinned,
    }
  }

  const orderedGroups = orderCustomGroups(groups)
  const displayGroups = orderedGroups.map((group) => {
    const urls = new Set(group.urls)
    return toDisplayGroup(
      group.id,
      group.name,
      tabs.filter((tab) => urls.has(tab.url)),
      group.urls.length,
      Boolean(group.pinned),
    )
  })
  const ungroupedTabs = tabs.filter((tab) => !groupedUrls.has(tab.url))

  return ungroupedTabs.length > 0
    ? [
        ...displayGroups,
        toDisplayGroup(UNGROUPED_CUSTOM_GROUP_KEY, t('ungroupedTabs'), ungroupedTabs, 0, false),
      ]
    : displayGroups
}
