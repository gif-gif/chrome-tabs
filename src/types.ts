import type { PageSnapshot } from './domain/markdown'
import type { UiLanguagePreference } from './i18n/i18n'

export type UiViewMode = 'list' | 'domain' | 'custom'
export type UiColorScheme = 'auto' | 'light' | 'dark'

export interface UiPreferences {
  globalMasked: boolean
  viewMode: UiViewMode
  language: UiLanguagePreference
  colorScheme: UiColorScheme
  pinnedTabIds: number[]
  pinnedDomainKeys: string[]
}

export interface BrowserTab {
  id: number
  windowId: number
  index: number
  active: boolean
  title: string
  url: string
  favIconUrl?: string
}

/** Next action of the header sort button: sort ascending, descending, or restore the pre-sort order. */
export type TabSortStep = 'asc' | 'desc' | 'restore'

export interface BrowserWindow {
  id: number
  focused: boolean
  tabs: BrowserTab[]
}

export interface DisplayTab {
  id: number
  windowId: number
  index: number
  active: boolean
  masked: boolean
  displayTitle: string
  displayUrl: string
  displayFavIconUrl?: string
  /** False for pages Chrome does not let extensions read, such as chrome://. */
  markdownSupported: boolean
}

export interface DisplayWindow {
  id: number
  focused: boolean
  label: string
  tabs: DisplayTab[]
}

export interface DisplayDomainGroup {
  key: string
  label: string
  tabs: DisplayTab[]
  allMasked: boolean
}

/**
 * A user-maintained tab group. Membership is stored by URL because Chrome tab
 * ids change after a browser restart.
 */
export interface CustomTabGroup {
  id: string
  name: string
  urls: string[]
  /**
   * Last seen page title per saved URL, so an entry stays recognizable while
   * its tab is closed. Missing for groups saved before titles were kept.
   */
  titles?: Record<string, string>
  /** Pinned groups are listed before unpinned ones. */
  pinned?: boolean
}

/** A saved custom group entry whose URL has no open tab. */
export interface DisplaySavedTab {
  url: string
  masked: boolean
  displayTitle: string
  displayUrl: string
  displayFavIconUrl?: string
}

/** One row of a custom group: the saved URL and its open tab, if any. */
export type DisplayCustomGroupEntry =
  | { url: string; tab: DisplayTab; saved?: undefined }
  | { url: string; tab?: undefined; saved: DisplaySavedTab }

export interface DisplayCustomGroup extends DisplayDomainGroup {
  /** Rows in display order; `tabs` lists the open ones among them. */
  entries: DisplayCustomGroupEntry[]
  /** Number of saved URLs, including ones without an open tab. */
  savedUrlCount: number
  pinned: boolean
}

export interface ChromeTabsApi {
  queryWindows(): Promise<BrowserWindow[]>
  activateTab(tabId: number, windowId: number): Promise<void>
  closeTab(tabId: number): Promise<void>
  /** Opens the URL in a new active tab and focuses its window. */
  openTab(url: string, windowId?: number): Promise<BrowserTab>
  /** Moves a tab, not a copy of it, into a new focused window. */
  openTabInNewWindow(tabId: number): Promise<void>
  moveTabs(tabIds: number[], windowId: number): Promise<void>
  /** Reads a tab's live HTML for Markdown conversion. */
  capturePage(tabId: number, url: string): Promise<PageSnapshot>
  subscribe(listener: () => void): () => void
}
