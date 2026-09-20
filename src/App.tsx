import { useEffect, useMemo, useRef, useState } from 'react'
import { createSafeChromeTabsApi } from './chrome/chromeTabs'
import { DomainGroup } from './components/DomainGroup'
import { Header } from './components/Header'
import { LanguageMenu } from './components/LanguageMenu'
import { ThemeToggle } from './components/ThemeToggle'
import { Icon } from './components/Icon'
import { SearchFilters } from './components/SearchFilters'
import { StatusView, type StatusViewState } from './components/StatusView'
import { WindowGroup } from './components/WindowGroup'
import {
  createDisplayDomainGroups,
  createDomainSortedTabIds,
  createDisplayWindows,
  createDisplayWindowsPresentationContext,
  filterWindows,
  findDuplicateTabIds,
  getTabDomainGroupKey,
  sortWindowsCurrentFirst,
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
import type {
  ChromeTabsApi,
  DisplayDomainGroup,
  DisplayTab,
  TabFilter,
} from './types'


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
  const [filter, setFilter] = useState<TabFilter>('all')
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
  const [theme, setTheme] = useState(initialPreferences.theme)
  const [pinnedTabIds, setPinnedTabIds] = useState<Set<number>>(
    () => new Set(initialPreferences.pinnedTabIds),
  )
  const [pinnedDomainKeys, setPinnedDomainKeys] = useState<Set<string>>(
    () => new Set(initialPreferences.pinnedDomainKeys),
  )
  const [favoriteUrls, setFavoriteUrls] = useState<Set<string>>(
    () => new Set(initialPreferences.favoriteUrls),
  )
  const [sortingTabs, setSortingTabs] = useState(false)
  const [tabMaskOverrides, setTabMaskOverrides] = useState<Map<number, boolean>>(
    () => new Map(),
  )
  const [operationMessage, setOperationMessage] = useState<PlainTranslationKey | null>(null)
  const [pendingTabIds, setPendingTabIds] = useState<Set<number>>(() => new Set())
  const [copiedTabIds, setCopiedTabIds] = useState<Set<number>>(() => new Set())
  const pendingTabIdsRef = useRef(new Set<number>())
  const copiedResetTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const operationSequenceRef = useRef(0)
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null)
  const [stickyToolbar, setStickyToolbar] = useState<HTMLElement | null>(null)
  const [auxiliaryControlsFocused, setAuxiliaryControlsFocused] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
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
      theme,
      pinnedTabIds: [...pinnedTabIds],
      pinnedDomainKeys: [...pinnedDomainKeys],
      favoriteUrls: [...favoriteUrls],
    })
  }, [favoriteUrls, globalMasked, language, pinnedDomainKeys, pinnedTabIds, theme, viewMode])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => () => {
    for (const timer of copiedResetTimersRef.current.values()) {
      clearTimeout(timer)
    }
    copiedResetTimersRef.current.clear()
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
  const favoriteTabIds = useMemo(
    () => new Set([...rawTabsById].filter(([, tab]) => tab.url.length > 0 && favoriteUrls.has(tab.url)).map(([tabId]) => tabId)),
    [favoriteUrls, rawTabsById],
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
    for (const [tabId, timer] of copiedResetTimersRef.current) {
      if (!existingTabIds.has(tabId)) {
        clearTimeout(timer)
        copiedResetTimersRef.current.delete(tabId)
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
      filterWindows(sortedWindows, {
        query,
        filter,
        focusedWindowId: effectiveFocusedWindowId,
        favoriteUrls,
      }),
    [effectiveFocusedWindowId, favoriteUrls, filter, query, sortedWindows],
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
  const existingDomainGroupKeys = useMemo(
    () => new Set(allDomainGroups.map((group) => group.key)),
    [allDomainGroups],
  )
  const tabCount = useMemo(
    () => windows.reduce((count, window) => count + window.tabs.length, 0),
    [windows],
  )
  const allDomainGroupsCollapsed =
    displayDomainGroups.length > 0 &&
    displayDomainGroups.every((group) => collapsedDomainGroupKeys.has(group.key))

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

  function handleTabFavoriteToggle(tab: DisplayTab) {
    const url = rawTabsById.get(tab.id)?.url
    if (!url) {
      return
    }

    setFavoriteUrls((current) => {
      const next = new Set(current)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
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

  function handleToggleAllDomainGroups() {
    setCollapsedDomainGroupKeys((current) => {
      if (
        displayDomainGroups.length > 0 &&
        displayDomainGroups.every((group) => current.has(group.key))
      ) {
        const next = new Set(current)
        for (const group of displayDomainGroups) {
          next.delete(group.key)
        }
        return next
      }

      const next = new Set(current)
      for (const group of displayDomainGroups) {
        next.add(group.key)
      }
      return next
    })
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

  function showCopiedCheckmark(tabId: number) {
    const existingTimer = copiedResetTimersRef.current.get(tabId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    setCopiedTabIds((current) => new Set(current).add(tabId))
    copiedResetTimersRef.current.set(
      tabId,
      setTimeout(() => {
        copiedResetTimersRef.current.delete(tabId)
        setCopiedTabIds((current) => {
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

    try {
      const moves = windows.flatMap((window) => {
        const currentIds = window.tabs.map((tab) => tab.id)
        const sortedIds = createDomainSortedTabIds(window.tabs)
        return currentIds.every((tabId, index) => tabId === sortedIds[index])
          ? []
          : [resolvedApi.moveTabs(sortedIds, window.id)]
      })
      await Promise.all(moves)
      await refresh()
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage(null)
      }
    } catch {
      if (operationSequence === operationSequenceRef.current) {
        setOperationMessage('sortTabsError')
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
              count={tabCount}
              filter={filter}
              globalMasked={globalMasked}
              onFilterChange={setFilter}
              onToggleMask={handleGlobalMaskToggle}
              onSortTabs={() => void handleSortTabs()}
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
                  <ThemeToggle theme={theme} onChange={setTheme} t={t} />
                </>
              }
              afterMaskAction={
                viewMode === 'domain' && displayDomainGroups.length > 0 ? (
                  <button
                    type="button"
                    className="compact-icon-button domain-collapse-all-button"
                    aria-label={allDomainGroupsCollapsed ? t('expandAllGroups') : t('collapseAllGroups')}
                    title={allDomainGroupsCollapsed ? t('expandAllGroups') : t('collapseAllGroups')}
                    onClick={handleToggleAllDomainGroups}
                  >
                    <Icon name={allDomainGroupsCollapsed ? 'expand-all' : 'collapse-all'} width={16} height={16} />
                  </button>
                ) : null
              }
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
                  onToggleFavorite={handleTabFavoriteToggle}
                  onToggleMask={handleTabMaskToggle}
                  onCopy={(tab) => void handleCopy(tab)}
                  onClose={(tab) => void handleClose(tab)}
                  pinnedTabIds={pinnedTabIds}
                  favoriteTabIds={favoriteTabIds}
                  pendingTabIds={pendingTabIds}
                  copiedTabIds={copiedTabIds}
                  t={t}
                />
              ))
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
                  onToggleFavorite={handleTabFavoriteToggle}
                  onToggleMask={handleTabMaskToggle}
                  onCopy={(tab) => void handleCopy(tab)}
                  onClose={(tab) => void handleClose(tab)}
                  pinnedTabIds={pinnedTabIds}
                  favoriteTabIds={favoriteTabIds}
                  pendingTabIds={pendingTabIds}
                  copiedTabIds={copiedTabIds}
                  t={t}
                />
              ))
          : null}
      </main>
    </div>
  )
}
