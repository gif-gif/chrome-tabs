import type { UiLanguagePreference } from './i18n/i18n'

export type UiViewMode = 'list' | 'domain'
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

export interface ChromeTabsApi {
  queryWindows(): Promise<BrowserWindow[]>
  activateTab(tabId: number, windowId: number): Promise<void>
  closeTab(tabId: number): Promise<void>
  moveTabs(tabIds: number[], windowId: number): Promise<void>
  subscribe(listener: () => void): () => void
}
