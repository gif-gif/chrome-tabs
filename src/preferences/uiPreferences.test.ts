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
    })
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
    })

    expect(UI_PREFERENCES_KEY).toBe('chrome-tabs.ui-preferences.v1')
    expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toEqual({
      version: 1,
      globalMasked: true,
      viewMode: 'domain',
      language: 'zh-CN',
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
