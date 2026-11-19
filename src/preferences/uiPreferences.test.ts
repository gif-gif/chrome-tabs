import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  UI_PREFERENCES_KEY,
  defaultUiPreferences,
  loadUiPreferences,
  saveUiPreferences,
} from './uiPreferences'

beforeEach(() => {
  localStorage.clear()
})

describe('UI preferences', () => {
  it('uses visible list defaults when nothing is stored', () => {
    expect(loadUiPreferences()).toEqual({
      globalMasked: false,
      viewMode: 'list',
      language: 'auto',
      colorScheme: 'auto',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
    })
  })

  it('loads known preferences and ignores the legacy drawerCollapsed field', () => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: true,
        viewMode: 'domain',
        drawerCollapsed: true,
      }),
    )

    expect(loadUiPreferences()).toEqual({
      globalMasked: true,
      viewMode: 'domain',
      language: 'auto',
      colorScheme: 'auto',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
    })
  })

  it.each(['auto', 'zh-CN', 'zh-TW', 'en'] as const)('restores the %s language preference', (language) => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ version: 1, globalMasked: false, viewMode: 'list', language }),
    )
    expect(loadUiPreferences()).toMatchObject({ language })
  })

  it('restores a valid manual language and falls back only an invalid language field', () => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: true,
        viewMode: 'domain',
        language: 'en',
      }),
    )
    expect(loadUiPreferences()).toEqual({
      globalMasked: true,
      viewMode: 'domain',
      language: 'en',
      colorScheme: 'auto',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
    })

    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: true,
        viewMode: 'domain',
        language: 'invalid',
      }),
    )
    expect(loadUiPreferences()).toEqual({
      globalMasked: true,
      viewMode: 'domain',
      language: 'auto',
      colorScheme: 'auto',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
    })
  })

  it('loads valid pin arrays, removes duplicates, and rejects malformed arrays', () => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        pinnedTabIds: [102, 102, 201],
        pinnedDomainKeys: ['example.com', 'example.com', 'google.com'],
      }),
    )
    expect(loadUiPreferences()).toMatchObject({
      pinnedTabIds: [102, 201],
      pinnedDomainKeys: ['example.com', 'google.com'],
    })

    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        pinnedTabIds: [0, '102'],
        pinnedDomainKeys: ['example.com', ''],
      }),
    )
    expect(loadUiPreferences()).toMatchObject({
      pinnedTabIds: [],
      pinnedDomainKeys: [],
    })
  })

  it('ignores legacy favorites and tab filter fields and drops them on the next save', () => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        favoriteUrls: ['https://example.com/favorite'],
        filter: 'favorites',
      }),
    )

    const preferences = loadUiPreferences()
    expect(preferences).toEqual(defaultUiPreferences)

    saveUiPreferences(preferences)
    const stored = JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')
    expect(stored).not.toHaveProperty('favoriteUrls')
    expect(stored).not.toHaveProperty('filter')
  })

  it.each(['auto', 'light', 'dark'] as const)('restores the supported %s color scheme', (colorScheme) => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ version: 1, globalMasked: false, viewMode: 'list', language: 'en', colorScheme }),
    )
    expect(loadUiPreferences()).toMatchObject({ colorScheme })
  })

  it.each([
    'not json',
    'null',
    '{}',
    JSON.stringify({
      version: 2,
      globalMasked: true,
      viewMode: 'domain',
    }),
    JSON.stringify({
      version: 1,
      globalMasked: 'yes',
      viewMode: 'domain',
    }),
    JSON.stringify({
      version: 1,
      globalMasked: true,
      viewMode: 'invalid',
      drawerCollapsed: true,
    }),
  ])('rejects malformed or unsupported stored data: %s', (storedValue) => {
    localStorage.setItem(UI_PREFERENCES_KEY, storedValue)

    expect(loadUiPreferences()).toEqual(defaultUiPreferences)
  })

  it('persists only the versioned global UI preferences', () => {
    saveUiPreferences({
      globalMasked: true,
      viewMode: 'domain',
      language: 'zh-CN',
      colorScheme: 'dark',
      pinnedTabIds: [102],
      pinnedDomainKeys: ['example.com'],
    })

    expect(UI_PREFERENCES_KEY).toBe('chrome-tabs.ui-preferences.v1')
    expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toEqual({
      version: 1,
      globalMasked: true,
      viewMode: 'domain',
      language: 'zh-CN',
      colorScheme: 'dark',
      pinnedTabIds: [102],
      pinnedDomainKeys: ['example.com'],
    })
  })

  it('falls back to defaults when storage reads throw and ignores write failures', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('read denied')
      }),
      setItem: vi.fn(() => {
        throw new Error('write denied')
      }),
    }

    expect(loadUiPreferences(storage)).toEqual(defaultUiPreferences)
    expect(() => saveUiPreferences(defaultUiPreferences, storage)).not.toThrow()
  })

  it('persists the custom group view mode', () => {
    saveUiPreferences({ ...defaultUiPreferences, viewMode: 'custom' })
    expect(loadUiPreferences().viewMode).toBe('custom')
  })


  it('restores a valid color scheme and ignores the removed theme field', () => {
    saveUiPreferences({ ...defaultUiPreferences, colorScheme: 'dark' })
    expect(loadUiPreferences().colorScheme).toBe('dark')

    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
      version: 1, globalMasked: false, viewMode: 'list', theme: 'aurora', colorScheme: 'sepia',
    }))
    expect(loadUiPreferences()).toMatchObject({ colorScheme: 'auto' })
    expect(loadUiPreferences()).not.toHaveProperty('theme')
  })

})
