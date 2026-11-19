import type { UiLanguagePreference } from '../i18n/i18n'
import {
  type PersistedTabFilter,
  type UiPreferences,
  type UiColorScheme,
  type UiViewMode,
} from '../types'

export const UI_PREFERENCES_KEY = 'chrome-tabs.ui-preferences.v1'
const UI_PREFERENCES_VERSION = 1

export const defaultUiPreferences: UiPreferences = {
  globalMasked: false,
  viewMode: 'list',
  language: 'auto',
  colorScheme: 'auto',
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
  colorScheme?: UiColorScheme
  pinnedTabIds?: number[]
  pinnedDomainKeys?: string[]
  favoriteUrls?: string[]
  filter?: PersistedTabFilter
}

function isViewMode(value: unknown): value is UiViewMode {
  return value === 'list' || value === 'domain' || value === 'custom'
}

function isPersistedTabFilter(value: unknown): value is PersistedTabFilter {
  return value === 'all' || value === 'favorites'
}

function isLanguage(value: unknown): value is UiLanguagePreference {
  return value === 'auto' || value === 'zh-CN' || value === 'zh-TW' || value === 'en'
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

function isColorScheme(value: unknown): value is UiColorScheme {
  return value === 'auto' || value === 'light' || value === 'dark'
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
      colorScheme: isColorScheme(candidate.colorScheme) ? candidate.colorScheme : 'auto',
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
    colorScheme: preferences.colorScheme,
    pinnedTabIds: preferences.pinnedTabIds,
    pinnedDomainKeys: preferences.pinnedDomainKeys,
    favoriteUrls: preferences.favoriteUrls,
    filter: preferences.filter,
  }
  try { storage.setItem(UI_PREFERENCES_KEY, JSON.stringify(storedPreferences)) } catch {
    // Preferences are best-effort and must never prevent the panel from loading.
  }
}
