import type { UiLanguagePreference } from '../i18n/i18n'
import {
  UI_THEMES,
  type PersistedTabFilter,
  type UiPreferences,
  type UiTheme,
  type UiViewMode,
} from '../types'

export const UI_PREFERENCES_KEY = 'chrome-tabs.ui-preferences.v1'
const UI_PREFERENCES_VERSION = 1

export const defaultUiPreferences: UiPreferences = {
  globalMasked: false,
  viewMode: 'list',
  language: 'auto',
  theme: 'classic',
  pinnedTabIds: [],
  pinnedDomainKeys: [],
  favoriteUrls: [],
  filter: 'all',
}

interface PreferencesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface StoredUiPreferences {
  version: typeof UI_PREFERENCES_VERSION
  globalMasked: boolean
  viewMode: UiViewMode
  language?: UiLanguagePreference
  theme?: UiTheme
  pinnedTabIds?: number[]
  pinnedDomainKeys?: string[]
  favoriteUrls?: string[]
  filter?: PersistedTabFilter
}

function isViewMode(value: unknown): value is UiViewMode {
  return value === 'list' || value === 'domain'
}

function isPersistedTabFilter(value: unknown): value is PersistedTabFilter {
  return value === 'all' || value === 'active' || value === 'favorites'
}

function isLanguage(value: unknown): value is UiLanguagePreference {
  return value === 'auto' || value === 'zh-CN' || value === 'en'
}

function isPositiveIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(
    (item) => Number.isInteger(item) && item > 0,
  )
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(
    (item) => typeof item === 'string' && item.trim().length > 0,
  )
}

function isTheme(value: unknown): value is UiTheme {
  return typeof value === 'string' && UI_THEMES.some((theme) => theme === value)
}

function parseStoredPreferences(value: string): UiPreferences | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<StoredUiPreferences>
    if (
      candidate.version !== UI_PREFERENCES_VERSION ||
      typeof candidate.globalMasked !== 'boolean' ||
      !isViewMode(candidate.viewMode)
    ) return null

    return {
      globalMasked: candidate.globalMasked,
      viewMode: candidate.viewMode,
      language: isLanguage(candidate.language) ? candidate.language : 'auto',
      theme: isTheme(candidate.theme) ? candidate.theme : 'classic',
      pinnedTabIds: isPositiveIntegerArray(candidate.pinnedTabIds)
        ? [...new Set(candidate.pinnedTabIds)]
        : [],
      pinnedDomainKeys: isNonEmptyStringArray(candidate.pinnedDomainKeys)
        ? [...new Set(candidate.pinnedDomainKeys)]
        : [],
      favoriteUrls: isNonEmptyStringArray(candidate.favoriteUrls)
        ? [...new Set(candidate.favoriteUrls)]
        : [],
      filter: isPersistedTabFilter(candidate.filter) ? candidate.filter : 'all',
    }
  } catch {
    return null
  }
}

function getDefaultStorage(): PreferencesStorage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

export function loadUiPreferences(
  storage: PreferencesStorage | undefined = getDefaultStorage(),
): UiPreferences {
  if (!storage) return { ...defaultUiPreferences }
  try {
    const storedValue = storage.getItem(UI_PREFERENCES_KEY)
    return storedValue
      ? (parseStoredPreferences(storedValue) ?? { ...defaultUiPreferences })
      : { ...defaultUiPreferences }
  } catch {
    return { ...defaultUiPreferences }
  }
}

export function saveUiPreferences(
  preferences: UiPreferences,
  storage: PreferencesStorage | undefined = getDefaultStorage(),
): void {
  if (!storage) return
  const storedPreferences: StoredUiPreferences = {
    version: UI_PREFERENCES_VERSION,
    globalMasked: preferences.globalMasked,
    viewMode: preferences.viewMode,
    language: preferences.language,
    theme: preferences.theme,
    pinnedTabIds: preferences.pinnedTabIds,
    pinnedDomainKeys: preferences.pinnedDomainKeys,
    favoriteUrls: preferences.favoriteUrls,
    filter: preferences.filter,
  }
  try { storage.setItem(UI_PREFERENCES_KEY, JSON.stringify(storedPreferences)) } catch {
    // Preferences are best-effort and must never prevent the panel from loading.
  }
}
