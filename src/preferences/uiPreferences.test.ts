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
      theme: 'classic',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
      favoriteUrls: [],
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
      theme: 'classic',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
      favoriteUrls: [],
    })
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
      theme: 'classic',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
      favoriteUrls: [],
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
      theme: 'classic',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
      favoriteUrls: [],
    })
  })

  it('loads valid pin and favorite arrays, removes duplicates, and rejects malformed arrays', () => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        pinnedTabIds: [102, 102, 201],
        pinnedDomainKeys: ['example.com', 'example.com', 'google.com'],
        favoriteUrls: [
          'https://example.com/a',
          'https://example.com/a',
          'https://example.com/b',
        ],
      }),
    )
    expect(loadUiPreferences()).toMatchObject({
      pinnedTabIds: [102, 201],
      pinnedDomainKeys: ['example.com', 'google.com'],
      favoriteUrls: ['https://example.com/a', 'https://example.com/b'],
    })

    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        pinnedTabIds: [0, '102'],
        pinnedDomainKeys: ['example.com', ''],
        favoriteUrls: ['https://example.com/a', '   '],
      }),
    )
    expect(loadUiPreferences()).toMatchObject({
      pinnedTabIds: [],
      pinnedDomainKeys: [],
      favoriteUrls: [],
    })
  })

  it.each([
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
  ] as const)(
    'restores the supported %s theme',
    (theme) => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        language: 'en',
        theme,
      }),
    )
    expect(loadUiPreferences()).toMatchObject({ theme })
    },
  )

  it('falls back only an invalid theme field', () => {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        language: 'en',
        theme: 'unknown',
      }),
    )
    expect(loadUiPreferences()).toMatchObject({ theme: 'classic' })
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
      theme: 'aurora',
      pinnedTabIds: [102],
      pinnedDomainKeys: ['example.com'],
      favoriteUrls: ['https://example.com/favorite'],
    })

    expect(UI_PREFERENCES_KEY).toBe('chrome-tabs.ui-preferences.v1')
    expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toEqual({
      version: 1,
      globalMasked: true,
      viewMode: 'domain',
      language: 'zh-CN',
      theme: 'aurora',
      pinnedTabIds: [102],
      pinnedDomainKeys: ['example.com'],
      favoriteUrls: ['https://example.com/favorite'],
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
})
