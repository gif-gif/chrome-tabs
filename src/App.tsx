import { useEffect, useMemo, useRef, useState } from 'react'
import { createSafeChromeTabsApi } from './chrome/chromeTabs'
import { PageCaptureError, type PageCaptureErrorCode } from './chrome/pageCapture'
import { CustomGroup, type CustomGroupPickerOption } from './components/CustomGroup'
import { CustomGroupCreator } from './components/CustomGroupCreator'
import { DomainGroup } from './components/DomainGroup'
import { Header } from './components/Header'
import { LanguageMenu } from './components/LanguageMenu'
import { ColorSchemeToggle } from './components/ColorSchemeToggle'
import { Icon } from './components/Icon'
import { SearchFilters } from './components/SearchFilters'
import { StatusView, type StatusViewState } from './components/StatusView'
import { WindowGroup } from './components/WindowGroup'
import {
  addCustomGroup,
  createDisplayCustomGroups,
  deleteCustomGroup,
  listSelectableTabs,
  moveCustomGroup,
  reorderCustomGroup,
  toggleCustomGroupPin,
  renameCustomGroup,
  toggleCustomGroupUrl,
  UNGROUPED_CUSTOM_GROUP_KEY,
} from './domain/customGroups'
import {
  createDisplayDomainGroups,
  createDomainSortedTabIds,
  createRestoredTabIds,
  createTabOrderSnapshot,
  createDisplayWindows,
  createDisplayWindowsPresentationContext,
  filterWindows,
  findDuplicateTabIds,
  getTabDomainGroupKey,
  resolveMasked,
  findCurrentTab,
  sortWindowsCurrentFirst,
  toggleAllCollapsed,
} from './domain/tabs'
import { useChromeTabs } from './hooks/useChromeTabs'
import { useStickySearchProgress } from './hooks/useStickySearchProgress'
import {
  createTranslator,
  resolveLocale,
  type PlainTranslationKey,
  type UiLanguagePreference,
} from './i18n/i18n'
import { loadUiPreferences, saveUiPreferences } from './preferences/uiPreferences'
import {
  loadCollapsedCustomGroupKeys,
  loadCustomGroups,
  saveCollapsedCustomGroupKeys,
  saveCustomGroups,
} from './preferences/customGroups'
import {
  loadTabSortState,
  saveTabSortState,
  type TabSortState,
} from './preferences/tabSortState'
import type {
  ChromeTabsApi,
  CustomTabGroup,
  DisplayCustomGroup,
  DisplayDomainGroup,
  DisplayTab,
} from './types'


const markdownErrorMessages: Record<PageCaptureErrorCode, PlainTranslationKey> = {
  unsupported: 'markdownUnsupportedTip',
  fileAccess: 'markdownFileAccessError',
  permissionDenied: 'markdownPermissionError',
  unloaded: 'markdownUnloadedError',
  failed: 'markdownError',
}

function markdownErrorMessage(error: unknown): PlainTranslationKey {
  if (error instanceof PageCaptureError) return markdownErrorMessages[error.code]
  if (error instanceof Error && error.name === 'EmptyPageError') return 'markdownEmptyError'
  return 'markdownError'
}

interface AppProps {
  api?: ChromeTabsApi
}

export function App({ api }: AppProps) {
  const resolvedApi = useMemo(() => api ?? createSafeChromeTabsApi(), [api])
  const { windows, focusedWindowId, loading, error, refresh } =
    useChromeTabs(resolvedApi)
  const [initialPreferences] = useState(loadUiPreferences)
  const [language, setLanguage] = useState<UiLanguagePreference>(
    initialPreferences.language,
  )
  const locale = useMemo(
    () => resolveLocale(language, globalThis.navigator?.languages ?? []),
    [language],
  )
  const t = useMemo(() => createTranslator(locale), [locale])
  const [query, setQuery] = useState('')
  const [collapsedWindowIds, setCollapsedWindowIds] = useState<Set<number>>(
    () => new Set(),
  )
  const [collapsedDomainGroupKeys, setCollapsedDomainGroupKeys] = useState<
    Set<string>
  >(() => new Set())
  const [globalMasked, setGlobalMasked] = useState(
    initialPreferences.globalMasked,
  )
  const [viewMode, setViewMode] = useState(initialPreferences.viewMode)
  const [colorScheme, setColorScheme] = useState(initialPreferences.colorScheme)
  const [pinnedTabIds, setPinnedTabIds] = useState<Set<number>>(
    () => new Set(initialPreferences.pinnedTabIds),
  )
  const [pinnedDomainKeys, setPinnedDomainKeys] = useState<Set<string>>(
    () => new Set(initialPreferences.pinnedDomainKeys),
  )
  const [customGroups, setCustomGroups] = useState<CustomTabGroup[]>(loadCustomGroups)
  const [draggingCustomGroupKey, setDraggingCustomGroupKey] = useState<string | null>(null)
  const [customGroupDropKey, setCustomGroupDropKey] = useState<string | null>(null)
  const [collapsedCustomGroupKeys, setCollapsedCustomGroupKeys] = useState<
    Set<string>
  >(() => loadCollapsedCustomGroupKeys(new Set([
    ...customGroups.map((group) => group.id),
    UNGROUPED_CUSTOM_GROUP_KEY,
  ])))
  const [tabSortState, setTabSortState] = useState<TabSortState>(loadTabSortState)
  const [sortingTabs, setSortingTabs] = useState(false)
  const [tabMaskOverrides, setTabMaskOverrides] = useState<Map<number, boolean>>(
    () => new Map(),
  )
  const [operationMessage, setOperationMessage] = useState<PlainTranslationKey | null>(null)
  const [pendingTabIds, setPendingTabIds] = useState<Set<number>>(() => new Set())
  const [copiedTabIds, setCopiedTabIds] = useState<Set<number>>(() => new Set())
  const [markdownCopiedTabIds, setMarkdownCopiedTabIds] = useState<Set<number>>(() => new Set())
  const pendingTabIdsRef = useRef(new Set<number>())
  const copiedResetTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const markdownCopiedResetTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const operationSequenceRef = useRef(0)
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null)
  const [stickyToolbar, setStickyToolbar] = useState<HTMLElement | null>(null)
  const [auxiliaryControlsFocused, setAuxiliaryControlsFocused] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [locateTabId, setLocateTabId] = useState<number | null>(null)
  const locatedRowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const auxiliaryControlsHidden = useStickySearchProgress(
    scrollContainer,
    stickyToolbar,
    {
      distance: 64,
      compactThreshold: 0.96,
      paused: auxiliaryControlsFocused || languageMenuOpen,
    },
  )

  useEffect(() => {
    saveUiPreferences({
      globalMasked,
      viewMode,
      language,
      colorScheme,
      pinnedTabIds: [...pinnedTabIds],
      pinnedDomainKeys: [...pinnedDomainKeys],
    })
  }, [globalMasked, language, pinnedDomainKeys, pinnedTabIds, colorScheme, viewMode])

  useEffect(() => {
    saveCustomGroups(customGroups)
  }, [customGroups])

  useEffect(() => {
    saveCollapsedCustomGroupKeys(collapsedCustomGroupKeys)
  }, [collapsedCustomGroupKeys])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    document.documentElement.dataset.colorScheme = colorScheme
  }, [colorScheme])

  useEffect(() => () => {
    for (const timers of [copiedResetTimersRef.current, markdownCopiedResetTimersRef.current]) {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  const existingWindowIds = useMemo(
    () => new Set(windows.map((window) => window.id)),
    [windows],
  )
  const existingTabIds = useMemo(
    () => new Set(windows.flatMap((window) => window.tabs.map((tab) => tab.id))),
    [windows],
  )
  const rawTabsById = useMemo(
    () => new Map(windows.flatMap((window) => window.tabs.map((tab) => [tab.id, tab] as const))),
    [windows],
  )
  // Counted over every open tab, not the filtered view, so search never
  // re-enables the action for a tab that is alone in its window.
  const soleWindowTabIds = useMemo(
    () => new Set(windows.flatMap((window) => window.tabs.length === 1 ? [window.tabs[0].id] : [])),
    [windows],
  )
  const tabIdToDomainKey = useMemo(
    () => new Map(
      windows.flatMap((window) => window.tabs.map((tab) => [
        tab.id,
        getTabDomainGroupKey(tab.url),
      ] as const)),
    ),
    [windows],
  )
  const existingRawDomainKeys = useMemo(
    () => new Set(tabIdToDomainKey.values()),
    [tabIdToDomainKey],
  )

  useEffect(() => {
    setCollapsedWindowIds((current) => {
      const next = new Set(
        [...current].filter((windowId) => existingWindowIds.has(windowId)),
      )
      return next.size === current.size ? current : next
    })
    setTabMaskOverrides((current) => {
      const next = new Map(
        [...current].filter(([tabId]) => existingTabIds.has(tabId)),
      )
      return next.size === current.size ? current : next
    })
    setCopiedTabIds((current) => {
      const next = new Set([...current].filter((tabId) => existingTabIds.has(tabId)))
      return next.size === current.size ? current : next
    })
    setMarkdownCopiedTabIds((current) => {
      const next = new Set([...current].filter((tabId) => existingTabIds.has(tabId)))
      return next.size === current.size ? current : next
    })
    if (!loading) {
      setPinnedTabIds((current) => {
        const next = new Set([...current].filter((tabId) => existingTabIds.has(tabId)))
        return next.size === current.size ? current : next
      })
      setPinnedDomainKeys((current) => {
        const next = new Set([...current].filter((domainKey) => existingRawDomainKeys.has(domainKey)))
        return next.size === current.size ? current : next
      })
    }
    for (const timers of [copiedResetTimersRef.current, markdownCopiedResetTimersRef.current]) {
      for (const [tabId, timer] of timers) {
        if (!existingTabIds.has(tabId)) {
          clearTimeout(timer)
          timers.delete(tabId)
        }
      }
    }
  }, [existingRawDomainKeys, existingTabIds, existingWindowIds, loading])

  const effectiveFocusedWindowId =
    focusedWindowId ?? windows.find((window) => window.focused)?.id ?? -1
  const sortedWindows = useMemo(
    () => sortWindowsCurrentFirst(windows, effectiveFocusedWindowId),
    [effectiveFocusedWindowId, windows],
  )
  const filteredWindows = useMemo(
    () =>
      filterWindows(sortedWindows, { query }),
    [query, sortedWindows],
  )
  const presentationContext = useMemo(
    () =>
      createDisplayWindowsPresentationContext(
        windows,
        effectiveFocusedWindowId,
      ),
    [effectiveFocusedWindowId, windows],
  )
  const displayWindows = useMemo(
    () =>
      createDisplayWindows(
        filteredWindows,
        globalMasked,
        tabMaskOverrides,
        presentationContext,
        t,
        pinnedTabIds,
      ),
    [filteredWindows, globalMasked, pinnedTabIds, presentationContext, t, tabMaskOverrides],
  )
  const displayDomainGroups = useMemo(
    () =>
      createDisplayDomainGroups(
        filteredWindows,
        globalMasked,
        tabMaskOverrides,
        t,
        pinnedTabIds,
        pinnedDomainKeys,
      ),
    [filteredWindows, globalMasked, pinnedDomainKeys, pinnedTabIds, t, tabMaskOverrides],
  )
  const allDomainGroups = useMemo(
    () =>
      createDisplayDomainGroups(
        sortedWindows,
        globalMasked,
        tabMaskOverrides,
        t,
        pinnedTabIds,
        pinnedDomainKeys,
      ),
    [globalMasked, pinnedDomainKeys, pinnedTabIds, sortedWindows, t, tabMaskOverrides],
  )
  const displayCustomGroups = useMemo(
    () =>
      createDisplayCustomGroups(
        filteredWindows,
        customGroups,
        globalMasked,
        tabMaskOverrides,
        t,
        pinnedTabIds,
      ),
    [customGroups, filteredWindows, globalMasked, pinnedTabIds, t, tabMaskOverrides],
  )
  const openTabCountByCustomGroup = useMemo(() => {
    const openUrls = sortedWindows.flatMap((window) => window.tabs.map((tab) => tab.url))
    return new Map(customGroups.map((group) => {
      const urls = new Set(group.urls)
      return [group.id, openUrls.filter((url) => urls.has(url)).length]
    }))
  }, [customGroups, sortedWindows])
  const selectableTabs = useMemo(
    () => listSelectableTabs(sortedWindows),
    [sortedWindows],
  )
  const existingDomainGroupKeys = useMemo(
    () => new Set(allDomainGroups.map((group) => group.key)),
    [allDomainGroups],
  )
  const visibleSectionKeys = {
    list: displayWindows.map((window) => window.id),
    domain: displayDomainGroups.map((group) => group.key),
    custom: displayCustomGroups.map((group) => group.key),
  }
  const visibleSectionCount = visibleSectionKeys[viewMode].length

  // Locating runs over a few renders: wait until the tab is shown (after a
  // filter reset), expand its section, then scroll to it and flash the row.
  useEffect(() => {
    if (locateTabId === null) return
    const holds = (section: { tabs: readonly DisplayTab[] }) =>
      section.tabs.some((tab) => tab.id === locateTabId)
    if (viewMode === 'list') {
      const section = displayWindows.find(holds)
      if (!section) return
      if (collapsedWindowIds.has(section.id)) {
        setCollapsedWindowIds((current) => { const next = new Set(current); next.delete(section.id); return next })
        return
      }
    } else {
      const section = (viewMode === 'domain' ? displayDomainGroups : displayCustomGroups).find(holds)
      if (!section) return
      const collapsed = viewMode === 'domain' ? collapsedDomainGroupKeys : collapsedCustomGroupKeys
      const setCollapsed = viewMode === 'domain' ? setCollapsedDomainGroupKeys : setCollapsedCustomGroupKeys
      if (collapsed.has(section.key)) {
        setCollapsed((current) => { const next = new Set(current); next.delete(section.key); return next })
        return
      }
    }

    setLocateTabId(null)
    const row = scrollContainer?.querySelector<HTMLElement>(`.tab-row[data-tab-id="${locateTabId}"]`)
    if (!row) return
    row.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    // data-located is not managed by React, so re-renders leave it alone.
    row.dataset.located = 'true'
    if (locatedRowTimerRef.current) clearTimeout(locatedRowTimerRef.current)
    locatedRowTimerRef.current = setTimeout(() => {
      delete row.dataset.located
      locatedRowTimerRef.current = null
    }, 1600)
  }, [collapsedCustomGroupKeys, collapsedDomainGroupKeys, collapsedWindowIds, displayCustomGroups, displayDomainGroups, displayWindows, locateTabId, scrollContainer, viewMode])

  useEffect(() => () => {
    if (locatedRowTimerRef.current) clearTimeout(locatedRowTimerRef.current)
  }, [])
  const allSectionsCollapsed =
    viewMode === 'list'
      ? visibleSectionKeys.list.length > 0 && visibleSectionKeys.list.every((id) => collapsedWindowIds.has(id))
      : viewMode === 'domain'
        ? visibleSectionKeys.domain.length > 0 && visibleSectionKeys.domain.every((key) => collapsedDomainGroupKeys.has(key))
        : visibleSectionKeys.custom.length > 0 && visibleSectionKeys.custom.every((key) => collapsedCustomGroupKeys.has(key))

  useEffect(() => {
    setCollapsedDomainGroupKeys((current) => {
      const next = new Set(
        [...current].filter((groupKey) => existingDomainGroupKeys.has(groupKey)),
      )
      return next.size === current.size ? current : next
    })
  }, [existingDomainGroupKeys])

  const hasLastGoodSnapshot = windows.length > 0
  const fatalError = Boolean(error && !hasLastGoodSnapshot)
  const status: Exclude<StatusViewState, 'error'> =
    loading && !hasLastGoodSnapshot
      ? 'loading'
      : displayWindows.length === 0
        ? 'empty'
        : 'ready'

  function handleGlobalMaskToggle() {
    setGlobalMasked((current) => !current)
    setTabMaskOverrides(new Map())
  }

  function handleTabMaskToggle(tab: DisplayTab) {
    setTabMaskOverrides((current) => {
      const next = new Map(current)
      next.set(tab.id, !tab.masked)
      return next
    })
  }

  function handleTabPinToggle(tab: DisplayTab) {
    setPinnedTabIds((current) => {
      const next = new Set(current)
      if (next.has(tab.id)) {
        next.delete(tab.id)
      } else {
        next.add(tab.id)
      }
      return next
    })
  }

  function handleDomainGroupPinToggle(group: DisplayDomainGroup) {
    const domainKey = group.tabs[0]
      ? tabIdToDomainKey.get(group.tabs[0].id)
      : undefined
    if (!domainKey) {
      return
    }

    setPinnedDomainKeys((current) => {
      const next = new Set(current)
      if (next.has(domainKey)) {
        next.delete(domainKey)
      } else {
        next.add(domainKey)
      }
      return next
    })
  }

  function handleDomainGroupMaskToggle(group: DisplayDomainGroup) {
    const nextMasked = !group.allMasked
    setTabMaskOverrides((current) => {
      const next = new Map(current)
      for (const tab of group.tabs) {
        next.set(tab.id, nextMasked)
      }
      return next
    })
  }

  function handleCollapseToggle(windowId: number) {
    setCollapsedWindowIds((current) => {
      const next = new Set(current)
      if (next.has(windowId)) {
        next.delete(windowId)
      } else {
        next.add(windowId)
      }
      return next
    })
  }

  function handleDomainGroupCollapseToggle(groupKey: string) {
    setCollapsedDomainGroupKeys((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const currentTab = findCurrentTab(windows, effectiveFocusedWindowId)

  function handleLocateCurrentTab() {
    if (!currentTab) return
    const visible = (viewMode === 'list' ? displayWindows : viewMode === 'domain' ? displayDomainGroups : displayCustomGroups)
      .some((section) => section.tabs.some((tab) => tab.id === currentTab.id))
    if (!visible) {
      setQuery('')
    }
    setLocateTabId(currentTab.id)
  }

  function handleToggleAllSections() {
    if (viewMode === 'list') {
      setCollapsedWindowIds((current) => toggleAllCollapsed(current, visibleSectionKeys.list))
    } else if (viewMode === 'domain') {
      setCollapsedDomainGroupKeys((current) => toggleAllCollapsed(current, visibleSectionKeys.domain))
    } else {
      setCollapsedCustomGroupKeys((current) => toggleAllCollapsed(current, visibleSectionKeys.custom))
    }
  }

  function handleCustomGroupCollapseToggle(groupKey: string) {
    setCollapsedCustomGroupKeys((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  function handleCreateCustomGroup(name: string) {
    setCustomGroups((current) =>
      addCustomGroup(current, globalThis.crypto.randomUUID(), name),
    )
  }

  function handleRenameCustomGroup(groupKey: string, name: string) {
    setCustomGroups((current) => renameCustomGroup(current, groupKey, name))
  }

  function handleDeleteCustomGroup(group: DisplayCustomGroup) {
    if (!window.confirm(t('deleteCustomGroupConfirm', { label: group.label }))) {
      return
    }
    setCustomGroups((current) => deleteCustomGroup(current, group.key))
    setCollapsedCustomGroupKeys((current) => {
      if (!current.has(group.key)) return current
      const next = new Set(current)
      next.delete(group.key)
      return next
    })
  }

  function handleMoveCustomGroup(groupKey: string, offset: -1 | 1) {
    setCustomGroups((current) => moveCustomGroup(current, groupKey, offset))
  }

  function isSameCustomGroupSection(sourceKey: string, targetKey: string) {
    const source = customGroups.find((group) => group.id === sourceKey)
    const target = customGroups.find((group) => group.id === targetKey)
    return Boolean(source && target && Boolean(source.pinned) === Boolean(target.pinned))
  }

  function handleCustomGroupDragOver(groupKey: string): boolean {
    if (!draggingCustomGroupKey || !isSameCustomGroupSection(draggingCustomGroupKey, groupKey)) {
      return false
    }
    if (customGroupDropKey !== groupKey) {
      setCustomGroupDropKey(groupKey === draggingCustomGroupKey ? null : groupKey)
    }
    return true
  }

  function handleCustomGroupDrop(groupKey: string) {
    if (draggingCustomGroupKey) {
      const sourceKey = draggingCustomGroupKey
      setCustomGroups((current) => reorderCustomGroup(current, sourceKey, groupKey))
    }
    setDraggingCustomGroupKey(null)
    setCustomGroupDropKey(null)
  }

  function handleCustomGroupDragEnd() {
    setDraggingCustomGroupKey(null)
    setCustomGroupDropKey(null)
  }

  function handleToggleCustomGroupPin(groupKey: string) {
    setCustomGroups((current) => toggleCustomGroupPin(current, groupKey))
  }

  function handleToggleCustomGroupUrl(groupKey: string, url: string) {
    setCustomGroups((current) => toggleCustomGroupUrl(current, groupKey, url))
  }

  function getCustomGroupPickerOptions(group: CustomTabGroup): CustomGroupPickerOption[] {
    const openUrls = new Set(selectableTabs.map((tab) => tab.url))
    return [
      ...selectableTabs.map((tab) => ({
        url: tab.url,
        tab,
        masked: resolveMasked(globalMasked, tabMaskOverrides, tab.id),
      })),
      ...group.urls
        .filter((url) => !openUrls.has(url))
        .map((url) => ({ url, masked: globalMasked })),
    ]
  }

  function beginOperation(tabId: number): number | null {
    if (pendingTabIdsRef.current.has(tabId)) {
      return null
    }

    pendingTabIdsRef.current.add(tabId)
    setPendingTabIds(new Set(pendingTabIdsRef.current))
    return ++operationSequenceRef.current
  }

  function beginGroupOperation(tabIds: readonly number[]): number | null {
    if (tabIds.some((tabId) => pendingTabIdsRef.current.has(tabId))) {
      return null
    }

    for (const tabId of tabIds) {
      pendingTabIdsRef.current.add(tabId)
    }
    setPendingTabIds(new Set(pendingTabIdsRef.current))
    return ++operationSequenceRef.current
  }

  function finishOperation(tabId: number) {
    pendingTabIdsRef.current.delete(tabId)
    setPendingTabIds(new Set(pendingTabIdsRef.current))
  }

  function finishGroupOperation(tabIds: readonly number[]) {
    for (const tabId of tabIds) {
      pendingTabIdsRef.current.delete(tabId)
    }
    setPendingTabIds(new Set(pendingTabIdsRef.current))
  }

  function showCopiedCheckmark(
    tabId: number,
    timers = copiedResetTimersRef.current,
    setCopied = setCopiedTabIds,
  ) {
    const existingTimer = timers.get(tabId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    setCopied((current) => new Set(current).add(tabId))
    timers.set(
      tabId,
      setTimeout(() => {
        timers.delete(tabId)
        setCopied((current) => {
          if (!current.has(tabId)) {
            return current
          }
          const next = new Set(current)
          next.delete(tabId)
          return next
        })
      }, 3000),
    )
  }

  async function handleActivate(tab: DisplayTab) {
    const operationSequence = beginOperation(tab.id)
    if (operationSequence === null) {
      return
    }

    try {
      await resolvedApi.activateTab(tab.id, tab.windowId)
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('activateError')
      }
      await refresh()
    } finally {
      finishOperation(tab.id)
    }
  }

  async function handleCopy(tab: DisplayTab) {
    const operationSequence = beginOperation(tab.id)
    if (operationSequence === null) {
      return
    }

    try {
      const sourceTab = windows
        .flatMap((window) => window.tabs)
        .find((candidate) => candidate.id === tab.id)
      if (!sourceTab?.url || !globalThis.navigator?.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }

      await globalThis.navigator.clipboard.writeText(sourceTab.url)
      showCopiedCheckmark(tab.id)
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('copyLinkError')
      }
    } finally {
      finishOperation(tab.id)
    }
  }

  async function handleCopyMarkdown(tab: DisplayTab) {
    const operationSequence = beginOperation(tab.id)
    if (operationSequence === null) {
      return
    }

    try {
      const sourceTab = rawTabsById.get(tab.id)
      if (!sourceTab?.url || !globalThis.navigator?.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }

      // Capture first so the permission prompt still follows the click.
      const snapshot = await resolvedApi.capturePage(sourceTab.id, sourceTab.url)
      const { convertPageToMarkdown } = await import('./domain/markdown')
      const { markdown } = convertPageToMarkdown(snapshot)
      await globalThis.navigator.clipboard.writeText(markdown)
      showCopiedCheckmark(tab.id, markdownCopiedResetTimersRef.current, setMarkdownCopiedTabIds)
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch (error) {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(markdownErrorMessage(error))
      }
    } finally {
      finishOperation(tab.id)
    }
  }

  async function handleOpenInNewWindow(tab: DisplayTab) {
    if (soleWindowTabIds.has(tab.id)) {
      return
    }

    const operationSequence = beginOperation(tab.id)
    if (operationSequence === null) {
      return
    }

    try {
      await resolvedApi.openTabInNewWindow(tab.id)
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('openTabInNewWindowError')
      }
    } finally {
      finishOperation(tab.id)
    }
    await refresh()
  }

  async function handleClose(tab: DisplayTab) {
    const operationSequence = beginOperation(tab.id)
    if (operationSequence === null) {
      return
    }

    try {
      await resolvedApi.closeTab(tab.id)
      setTabMaskOverrides((current) => {
        if (!current.has(tab.id)) {
          return current
        }
        const next = new Map(current)
        next.delete(tab.id)
        return next
      })
      setPinnedTabIds((current) => {
        if (!current.has(tab.id)) {
          return current
        }
        const next = new Set(current)
        next.delete(tab.id)
        return next
      })
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('closeTabError')
      }
      await refresh()
    } finally {
      finishOperation(tab.id)
    }
  }

  function getRawGroupTabs(group: DisplayDomainGroup) {
    const domainKey = group.tabs[0]
      ? tabIdToDomainKey.get(group.tabs[0].id)
      : undefined
    if (!domainKey) {
      return []
    }

    return sortedWindows.flatMap((window) =>
      window.tabs.filter((tab) => getTabDomainGroupKey(tab.url) === domainKey),
    )
  }

  function removeClosedTabState(closedTabIds: readonly number[]) {
    setTabMaskOverrides((current) => {
      if (!closedTabIds.some((tabId) => current.has(tabId))) {
        return current
      }
      const next = new Map(current)
      for (const tabId of closedTabIds) next.delete(tabId)
      return next
    })
    setPinnedTabIds((current) => {
      if (!closedTabIds.some((tabId) => current.has(tabId))) {
        return current
      }
      const next = new Set(current)
      for (const tabId of closedTabIds) next.delete(tabId)
      return next
    })
  }

  async function handleRemoveDuplicates(group: DisplayDomainGroup) {
    const duplicateTabIds = findDuplicateTabIds(getRawGroupTabs(group))
    if (duplicateTabIds.length === 0 ||
      !window.confirm(t('removeDuplicatesConfirm', { count: duplicateTabIds.length }))) {
      return
    }

    const operationSequence = beginGroupOperation(duplicateTabIds)
    if (operationSequence === null) return

    try {
      const results = await Promise.allSettled(
        duplicateTabIds.map((tabId) => resolvedApi.closeTab(tabId)),
      )
      const closedTabIds = duplicateTabIds.filter(
        (_, index) => results[index]?.status === 'fulfilled',
      )
      removeClosedTabState(closedTabIds)

      if (results.some((result) => result.status === 'rejected')) {
        if (operationSequence === operationSequenceRef.current) {
          setOperationMessage('removeDuplicatesError')
        }
        await refresh()
      } else if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('removeDuplicatesError')
      }
      await refresh()
    } finally {
      finishGroupOperation(duplicateTabIds)
    }
  }

  async function handleSortTabs() {
    if (sortingTabs) return
    setSortingTabs(true)
    const operationSequence = ++operationSequenceRef.current
    const { nextStep } = tabSortState
    const originalOrder =
      tabSortState.originalOrder ?? createTabOrderSnapshot(windows)

    try {
      const moves = windows.flatMap((window) => {
        const currentIds = window.tabs.map((tab) => tab.id)
        const targetIds = nextStep === 'restore'
          ? createRestoredTabIds(window.tabs, originalOrder.get(window.id) ?? [])
          : createDomainSortedTabIds(window.tabs, nextStep)
        return currentIds.every((tabId, index) => tabId === targetIds[index])
          ? []
          : [resolvedApi.moveTabs(targetIds, window.id)]
      })
      await Promise.all(moves)
      await refresh()
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
        const nextState: TabSortState = nextStep === 'asc'
          ? { nextStep: 'desc', originalOrder }
          : nextStep === 'desc'
            ? { nextStep: 'restore', originalOrder }
            : { nextStep: 'asc', originalOrder: null }
        setTabSortState(nextState)
        saveTabSortState(nextState)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(
          nextStep === 'restore' ? 'restoreTabOrderError' : 'sortTabsError',
        )
      }
      await refresh()
    } finally {
      setSortingTabs(false)
    }
  }

  async function handleCloseDomainGroup(group: DisplayDomainGroup) {
    const tabIds = group.tabs.map((tab) => tab.id)
    if (tabIds.length === 0) {
      return
    }

    if (!window.confirm(t('closeGroupConfirm', { count: tabIds.length }))) {
      return
    }

    const operationSequence = beginGroupOperation(tabIds)
    if (operationSequence === null) {
      return
    }

    try {
      const results = await Promise.allSettled(
        group.tabs.map((tab) => resolvedApi.closeTab(tab.id)),
      )
      const closedTabIds = tabIds.filter(
        (_, index) => results[index]?.status === 'fulfilled',
      )

      removeClosedTabState(closedTabIds)

      if (results.some((result) => result.status === 'rejected')) {
        if (operationSequence === operationSequenceRef.current) {
          setOperationMessage('closeGroupError')
        }
        await refresh()
        return
      }

      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('closeGroupError')
      }
      await refresh()
    } finally {
      finishGroupOperation(tabIds)
    }
  }

  return (
    <div className="popup-shell">
      <main className="popup-content" ref={setScrollContainer}>
        <div
          className="sticky-controls"
          ref={setStickyToolbar}
          role="toolbar"
          aria-label={t('toolbar')}
          data-compact={auxiliaryControlsHidden ? 'true' : 'false'}
          onFocusCapture={(event) => {
            if ((event.target as HTMLElement).closest('.toolbar-auxiliary')) {
              setAuxiliaryControlsFocused(true)
            }
          }}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget
            if (!(nextTarget instanceof HTMLElement) || !nextTarget.closest('.toolbar-auxiliary')) {
              setAuxiliaryControlsFocused(false)
            }
          }}
        >
          <div
            className={`toolbar-summary toolbar-auxiliary${auxiliaryControlsHidden ? ' is-hidden' : ''}`}
            aria-hidden={auxiliaryControlsHidden || undefined}
          >
            <Header
              globalMasked={globalMasked}
              onToggleMask={handleGlobalMaskToggle}
              onSortTabs={() => void handleSortTabs()}
              sortStep={tabSortState.nextStep}
              sortingTabs={sortingTabs}
              t={t}
              beforeMaskAction={
                <>
                  <LanguageMenu
                    open={languageMenuOpen}
                    value={language}
                    onOpenChange={(open, reason) => {
                      setLanguageMenuOpen(open)
                      if (!open && reason === 'outside-pointer') {
                        setAuxiliaryControlsFocused(false)
                      }
                    }}
                    onChange={setLanguage}
                    t={t}
                  />
                  <ColorSchemeToggle value={colorScheme} onChange={setColorScheme} t={t} />
                </>
              }
              afterMaskAction={<>
                {currentTab ? (
                  <button
                    type="button"
                    className="compact-icon-button locate-current-tab-button"
                    aria-label={t('locateCurrentTab')}
                    title={t('locateCurrentTab')}
                    onClick={handleLocateCurrentTab}
                  >
                    <Icon name="locate" width={16} height={16} />
                  </button>
                ) : null}
                {visibleSectionCount > 0 ? (
                  <button
                    type="button"
                    className="compact-icon-button domain-collapse-all-button"
                    aria-label={allSectionsCollapsed ? t('expandAllGroups') : t('collapseAllGroups')}
                    title={allSectionsCollapsed ? t('expandAllGroups') : t('collapseAllGroups')}
                    onClick={handleToggleAllSections}
                  >
                    <Icon name={allSectionsCollapsed ? 'expand-all' : 'collapse-all'} width={16} height={16} />
                  </button>
                ) : null}
              </>}
            />
          </div>
          <SearchFilters
            query={query}
            viewMode={viewMode}
            onQueryChange={setQuery}
            onViewModeChange={setViewMode}
            t={t}
          />
        </div>
        {error ? (
          <StatusView
            state="error"
            errorMessage={t(error)}
            operationMessage={operationMessage ? t(operationMessage) : null}
            t={t}
            onRetry={() => void refresh()}
          />
        ) : (
          <StatusView
            state={status}
            operationMessage={operationMessage ? t(operationMessage) : null}
            t={t}
          />
        )}
        {!fatalError && status !== 'loading'
          ? viewMode === 'list'
            ? displayWindows.map((window) => (
                <WindowGroup
                  key={window.id}
                  window={window}
                  collapsed={collapsedWindowIds.has(window.id)}
                  onToggleCollapse={handleCollapseToggle}
                  onActivate={(tab) => void handleActivate(tab)}
                  onTogglePin={handleTabPinToggle}
                  onToggleMask={handleTabMaskToggle}
                  onCopy={(tab) => void handleCopy(tab)}
                  onCopyMarkdown={(tab) => void handleCopyMarkdown(tab)}
                  onOpenInNewWindow={(tab) => void handleOpenInNewWindow(tab)}
                  onClose={(tab) => void handleClose(tab)}
                  soleWindowTabIds={soleWindowTabIds}
                  pinnedTabIds={pinnedTabIds}
                  pendingTabIds={pendingTabIds}
                  copiedTabIds={copiedTabIds}
                  markdownCopiedTabIds={markdownCopiedTabIds}
                  t={t}
                />
              ))
            : viewMode === 'custom'
              ? <>
                  <CustomGroupCreator onCreate={handleCreateCustomGroup} defaultOpen={customGroups.length === 0} t={t} />
                  {customGroups.length === 0 ? (
                    <div className="status-panel empty-state custom-groups-empty">
                      <p>{t('noCustomGroups')}</p>
                      <p>{t('noCustomGroupsHint')}</p>
                    </div>
                  ) : null}
                  {displayCustomGroups.map((group) => {
                    const sourceGroup = customGroups.find((candidate) => candidate.id === group.key)
                    return (
                      <CustomGroup
                        key={group.key}
                        group={group}
                        editable={group.key !== UNGROUPED_CUSTOM_GROUP_KEY && Boolean(sourceGroup)}
                        collapsed={collapsedCustomGroupKeys.has(group.key)}
                        pickerOptions={sourceGroup ? getCustomGroupPickerOptions(sourceGroup) : []}
                        selectedUrls={new Set(sourceGroup?.urls)}
                        onToggleCollapse={handleCustomGroupCollapseToggle}
                        onToggleUrl={handleToggleCustomGroupUrl}
                        onRename={handleRenameCustomGroup}
                        onDelete={handleDeleteCustomGroup}
                        onMove={handleMoveCustomGroup}
                        onDragStartGroup={setDraggingCustomGroupKey}
                        onDragEndGroup={handleCustomGroupDragEnd}
                        onDragOverGroup={handleCustomGroupDragOver}
                        onDropGroup={handleCustomGroupDrop}
                        dragging={draggingCustomGroupKey === group.key}
                        dropTarget={customGroupDropKey === group.key}
                        hiddenTabCount={Math.max(0, (openTabCountByCustomGroup.get(group.key) ?? 0) - group.tabs.length)}
                        onTogglePinGroup={handleToggleCustomGroupPin}
                        onToggleGroupMask={handleDomainGroupMaskToggle}
                        onCloseGroup={(customGroup) => void handleCloseDomainGroup(customGroup)}
                        onActivate={(tab) => void handleActivate(tab)}
                        onTogglePin={handleTabPinToggle}
                              onToggleMask={handleTabMaskToggle}
                        onCopy={(tab) => void handleCopy(tab)}
                  onCopyMarkdown={(tab) => void handleCopyMarkdown(tab)}
                        onOpenInNewWindow={(tab) => void handleOpenInNewWindow(tab)}
                        onClose={(tab) => void handleClose(tab)}
                        soleWindowTabIds={soleWindowTabIds}
                        pinnedTabIds={pinnedTabIds}
                              pendingTabIds={pendingTabIds}
                        copiedTabIds={copiedTabIds}
                  markdownCopiedTabIds={markdownCopiedTabIds}
                        t={t}
                      />
                    )
                  })}
                </>
            : displayDomainGroups.map((group) => (
                <DomainGroup
                  key={group.key}
                  group={group}
                  pinned={pinnedDomainKeys.has(
                    group.tabs[0] ? tabIdToDomainKey.get(group.tabs[0].id) ?? '' : '',
                  )}
                  collapsed={collapsedDomainGroupKeys.has(group.key)}
                  onToggleCollapse={handleDomainGroupCollapseToggle}
                  onToggleGroupPin={handleDomainGroupPinToggle}
                  duplicateCount={findDuplicateTabIds(getRawGroupTabs(group)).length}
                  onRemoveDuplicates={(domainGroup) => void handleRemoveDuplicates(domainGroup)}
                  onToggleGroupMask={handleDomainGroupMaskToggle}
                  onCloseGroup={(domainGroup) => void handleCloseDomainGroup(domainGroup)}
                  onActivate={(tab) => void handleActivate(tab)}
                  onTogglePin={handleTabPinToggle}
                  onToggleMask={handleTabMaskToggle}
                  onCopy={(tab) => void handleCopy(tab)}
                  onCopyMarkdown={(tab) => void handleCopyMarkdown(tab)}
                  onOpenInNewWindow={(tab) => void handleOpenInNewWindow(tab)}
                  onClose={(tab) => void handleClose(tab)}
                  soleWindowTabIds={soleWindowTabIds}
                  pinnedTabIds={pinnedTabIds}
                  pendingTabIds={pendingTabIds}
                  copiedTabIds={copiedTabIds}
                  markdownCopiedTabIds={markdownCopiedTabIds}
                  t={t}
                />
              ))
          : null}
      </main>
    </div>
  )
}
