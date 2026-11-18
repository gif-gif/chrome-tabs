import type { PageSnapshot } from './domain/markdown'
import type { UiLanguagePreference } from './i18n/i18n'

export type UiViewMode = 'list' | 'domain' | 'custom'
export type PersistedTabFilter = 'all' | 'active' | 'favorites'
export const UI_THEMES = [
  'classic',
  'aurora',
  'sunset',
  'twilight',
  'ocean',
  'forest',
  'sakura',
  'graphite',
  'lemon',
  'coffee',
  'midnight',
  'lavender',
  'mint',
  'coral',
  'sky',
  'amber',
  'teal',
  'ruby',
  'plum',
  'sand',
  'ice',
  'moss',
  'peach',
  'cobalt',
  'orchid',
  'crimson',
] as const

export type UiTheme = (typeof UI_THEMES)[number]

export interface UiPreferences {
  globalMasked: boolean
  viewMode: UiViewMode
  language: UiLanguagePreference
  theme: UiTheme
  pinnedTabIds: number[]
  pinnedDomainKeys: string[]
  favoriteUrls: string[]
  filter: PersistedTabFilter
}

export type TabFilter = 'all' | 'current-window' | 'active' | 'favorites'

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
  /** Pinned groups are listed before unpinned ones. */
  pinned?: boolean
}

export interface DisplayCustomGroup extends DisplayDomainGroup {
  /** Number of saved URLs, including ones without an open tab. */
  savedUrlCount: number
  pinned: boolean
}

export interface ChromeTabsApi {
  queryWindows(): Promise<BrowserWindow[]>
  activateTab(tabId: number, windowId: number): Promise<void>
  closeTab(tabId: number): Promise<void>
  moveTabs(tabIds: number[], windowId: number): Promise<void>
  /** Reads a tab's live HTML for Markdown conversion. */
  capturePage(tabId: number, url: string): Promise<PageSnapshot>
  subscribe(listener: () => void): () => void
}
