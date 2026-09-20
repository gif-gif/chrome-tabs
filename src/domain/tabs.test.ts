import { describe, expect, it } from 'vitest'
import { windows } from '../test/fixtures'
import { createTranslator } from '../i18n/i18n'
import type { BrowserWindow, DisplayDomainGroup, DisplayTab } from '../types'
import {
  createDisplayDomainGroups,
  createDomainSortedTabIds,
  createDisplayWindows,
  createDisplayWindowsPresentationContext,
  filterWindows,
  findDuplicateTabIds,
  getTabDomainGroupKey,
  resolveMasked,
  resolveSafeFaviconUrl,
  sortWindowsCurrentFirst,
} from './tabs'

type RawDisplayTabFields = Extract<
  keyof DisplayTab,
  'title' | 'url' | 'favIconUrl'
>
const displayTabHasNoRawFields: RawDisplayTabFields extends never ? true : false =
  true

type DisplayDomainGroupHasAllMasked = DisplayDomainGroup extends { allMasked: boolean }
  ? true
  : false
const displayDomainGroupHasAllMasked: DisplayDomainGroupHasAllMasked = true
const zh = createTranslator('zh-CN')

type CreateDisplayWindowsArguments = Parameters<typeof createDisplayWindows>
const createDisplayWindowsRequiresContext: CreateDisplayWindowsArguments[3] extends object
  ? true
  : false = true

const backgroundWindow30: BrowserWindow = {
  id: 30,
  focused: false,
  tabs: [
    {
      ...windows[1].tabs[0],
      id: 301,
      windowId: 30,
      title: 'Release Dashboard',
      url: 'https://releases.example.com/dashboard',
      favIconUrl: 'https://releases.example.com/favicon.ico',
    },
  ],
}

describe('sortWindowsCurrentFirst', () => {
  it('moves the focused window first while preserving the stable order of others', () => {
    const input = [
      backgroundWindow30,
      windows[0],
      windows[1],
    ]

    expect(sortWindowsCurrentFirst(input, 10).map((window) => window.id)).toEqual([
      10, 30, 20,
    ])
  })

  it('does not mutate the input array', () => {
    const input = [...windows]
    const originalOrder = input.map((window) => window.id)

    const result = sortWindowsCurrentFirst(input, 20)

    expect(result.map((window) => window.id)).toEqual([20, 10])
    expect(input.map((window) => window.id)).toEqual(originalOrder)
    expect(result).not.toBe(input)
  })
})

describe('filterWindows', () => {
  it('returns all tabs for the all filter and a blank query', () => {
    const result = filterWindows(windows, {
      query: '',
      filter: 'all',
      focusedWindowId: 10,
    })

    expect(result).toEqual(windows)
    expect(result).not.toBe(windows)
    expect(result[0]).not.toBe(windows[0])
    expect(result[0].tabs).not.toBe(windows[0].tabs)
  })

  it('matches titles case-insensitively after trimming the query', () => {
    const result = filterWindows(windows, {
      query: '  gItHuB  ',
      filter: 'all',
      focusedWindowId: 10,
    })

    expect(result).toHaveLength(1)
    expect(result[0].tabs.map((tab) => tab.id)).toEqual([101])
  })

  it('matches the complete URL case-insensitively', () => {
    const result = filterWindows(windows, {
      query: 'token=secret',
      filter: 'all',
      focusedWindowId: 10,
    })

    expect(result).toHaveLength(1)
    expect(result[0].tabs[0].url).toContain('TOKEN=SECRET')
  })

  it('keeps only the focused window for the current-window filter', () => {
    const result = filterWindows(windows, {
      query: '',
      filter: 'current-window',
      focusedWindowId: 10,
    })

    expect(result.map((window) => window.id)).toEqual([10])
    expect(result[0].tabs).toHaveLength(2)
  })

  it('keeps only active tabs and removes empty window groups', () => {
    const input = [
      ...windows,
      {
        id: 30,
        focused: false,
        tabs: [{ ...windows[0].tabs[1], id: 301, windowId: 30 }],
      },
    ]

    const result = filterWindows(input, {
      query: '',
      filter: 'active',
      focusedWindowId: 10,
    })

    expect(result.map((window) => window.id)).toEqual([10, 20])
    expect(result.flatMap((window) => window.tabs).every((tab) => tab.active)).toBe(
      true,
    )
  })

  it('combines the query with the current-window filter', () => {
    const result = filterWindows(windows, {
      query: 'docs.example.com',
      filter: 'current-window',
      focusedWindowId: 10,
    })

    expect(result).toEqual([])
  })

  it('combines the query with the active filter', () => {
    expect(
      filterWindows(windows, {
        query: 'mail',
        filter: 'active',
        focusedWindowId: 10,
      }),
    ).toEqual([])

    expect(
      filterWindows(windows, {
        query: 'documentation',
        filter: 'active',
        focusedWindowId: 10,
      }).flatMap((window) => window.tabs.map((tab) => tab.id)),
    ).toEqual([201])
  })

  it('keeps only currently open tabs whose exact non-empty URLs are favorites', () => {
    const result = filterWindows(windows, {
      query: '',
      filter: 'favorites',
      focusedWindowId: 10,
      favoriteUrls: new Set([
        windows[0].tabs[1].url,
        'https://closed.example.com/favorite',
        '',
      ]),
    })

    expect(result.map((window) => window.id)).toEqual([10])
    expect(result[0].tabs.map((tab) => tab.id)).toEqual([102])
  })

  it('combines favorites with search and uses exact URL matching', () => {
    const favoriteUrl = windows[1].tabs[0].url

    expect(filterWindows(windows, {
      query: 'documentation',
      filter: 'favorites',
      focusedWindowId: 10,
      favoriteUrls: new Set([favoriteUrl]),
    }).flatMap((window) => window.tabs.map((tab) => tab.id))).toEqual([201])

    expect(filterWindows(windows, {
      query: '',
      filter: 'favorites',
      focusedWindowId: 10,
      favoriteUrls: new Set([favoriteUrl.toLocaleUpperCase()]),
    })).toEqual([])
  })

  it('does not mutate the source windows or tabs', () => {
    const snapshot = structuredClone(windows)

    filterWindows(windows, {
      query: 'github',
      filter: 'all',
      focusedWindowId: 10,
    })

    expect(windows).toEqual(snapshot)
  })
})

describe('findDuplicateTabIds', () => {
  it('keeps the earliest exact non-empty URL and returns every later duplicate', () => {
    const tabs = [
      { ...windows[0].tabs[0], id: 1, url: 'https://example.com/path?q=1' },
      { ...windows[0].tabs[1], id: 2, url: 'https://example.com/path?q=1' },
      { ...windows[1].tabs[0], id: 3, url: 'https://example.com/path?q=2' },
      { ...windows[1].tabs[0], id: 4, url: 'https://example.com/path?q=1' },
    ]
    const snapshot = structuredClone(tabs)

    expect(findDuplicateTabIds(tabs)).toEqual([2, 4])
    expect(tabs).toEqual(snapshot)
  })

  it('treats URL case, path, and query differences as distinct and ignores empty URLs', () => {
    const base = windows[0].tabs[0]
    expect(findDuplicateTabIds([
      { ...base, id: 1, url: '' },
      { ...base, id: 2, url: '' },
      { ...base, id: 3, url: 'https://example.com/path?q=1' },
      { ...base, id: 4, url: 'https://EXAMPLE.com/path?q=1' },
      { ...base, id: 5, url: 'https://example.com/Path?q=1' },
      { ...base, id: 6, url: 'https://example.com/path?q=2' },
    ])).toEqual([])
  })
})

describe('createDomainSortedTabIds', () => {
  it('sorts registrable-domain groups ascending while keeping tabs within each group stable', () => {
    const base = windows[0].tabs[0]
    const tabs = [
      { ...base, id: 1, url: 'https://docs.google.com/a' },
      { ...base, id: 2, url: 'https://alpha.example.com/a' },
      { ...base, id: 3, url: 'https://drive.google.com/b' },
      { ...base, id: 4, url: 'chrome://settings/privacy' },
      { ...base, id: 5, url: 'https://beta.example.com/b' },
      { ...base, id: 6, url: 'https://www.google.com/c' },
    ]
    const snapshot = structuredClone(tabs)

    expect(createDomainSortedTabIds(tabs, 'asc')).toEqual([4, 2, 5, 1, 3, 6])
    expect(createDomainSortedTabIds(tabs, 'desc')).toEqual([1, 3, 6, 2, 5, 4])
    expect(tabs).toEqual(snapshot)
  })

  it('defaults to ascending order', () => {
    const base = windows[0].tabs[0]
    expect(createDomainSortedTabIds([
      { ...base, id: 1, url: 'https://zeta.com' },
      { ...base, id: 2, url: 'https://alpha.com' },
    ])).toEqual([2, 1])
  })

  it('keeps special and invalid URL groups stable', () => {
    const base = windows[0].tabs[0]
    expect(createDomainSortedTabIds([
      { ...base, id: 1, url: 'not valid one' },
      { ...base, id: 2, url: 'chrome://settings/privacy' },
      { ...base, id: 3, url: 'not valid two' },
      { ...base, id: 4, url: 'chrome://settings/search' },
    ])).toEqual([2, 4, 1, 3])
  })
})

describe('resolveMasked', () => {
  it('uses the global masked state when no override exists', () => {
    expect(resolveMasked(true, new Map(), 101)).toBe(true)
    expect(resolveMasked(false, new Map(), 101)).toBe(false)
  })

  it('uses an explicit unmasked override over a masked global state', () => {
    expect(resolveMasked(true, new Map([[101, false]]), 101)).toBe(false)
  })

  it('uses an explicit masked override over an unmasked global state', () => {
    expect(resolveMasked(false, new Map([[101, true]]), 101)).toBe(true)
  })
})

describe('createDisplayWindowsPresentationContext', () => {
  it('captures focused window identity and the original current-first order', () => {
    expect(createDisplayWindowsPresentationContext(windows, 20)).toEqual({
      focusedWindowId: 20,
      sortedWindowIds: [20, 10],
    })
  })
})


describe('resolveSafeFaviconUrl', () => {
  it('routes remote favicon inputs through the extension-local Chrome favicon service', () => {
    const faviconUrl = 'https://tracker.example/favicon.ico?account=secret'
    const pageUrl = 'https://example.com/private?token=secret'

    const result = resolveSafeFaviconUrl(faviconUrl, pageUrl)

    expect(result).toBe(
      `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`,
    )
    expect(result).not.toContain(faviconUrl)
    expect(result).not.toMatch(/^https?:/)
  })

  it('uses the local favicon service for chrome-extension pages too', () => {
    const pageUrl = 'chrome-extension://abcdefghijklmnop/options.html'

    expect(
      resolveSafeFaviconUrl(
        'chrome-extension://abcdefghijklmnop/icon.png',
        pageUrl,
      ),
    ).toBe(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`)
  })

  it.each([
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
    'data:image/x-icon;base64,AAABAAEAEBA=',
  ])('preserves an allowlisted inline image source: %s', (faviconUrl) => {
    expect(resolveSafeFaviconUrl(faviconUrl, 'https://example.com')).toBe(
      faviconUrl,
    )
  })

  it.each([
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
    'javascript:alert(1)',
    'blob:https://example.com/secret',
    '//tracker.example/favicon.ico',
  ])('rejects a non-allowlisted favicon source: %s', (faviconUrl) => {
    expect(resolveSafeFaviconUrl(faviconUrl, '')).toBeUndefined()
  })
})

describe('createDisplayWindows', () => {
  it('requires presentation context as its fourth argument', () => {
    expect(createDisplayWindowsRequiresContext).toBe(true)
  })

  it('defines DisplayTab without raw browser content fields', () => {
    expect(displayTabHasNoRawFields).toBe(true)
  })
  it('orders the focused window first and labels windows by display order', () => {
    const result = createDisplayWindows(
      windows,
      false,
      new Map(),
      createDisplayWindowsPresentationContext(windows, 10), zh
    )

    expect(result.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 10, label: '当前窗口' },
      { id: 20, label: '窗口 2' },
    ])
  })

  it('stably sorts pinned tabs first without changing the remaining tab order', () => {
    const result = createDisplayWindows(
      windows,
      false,
      new Map(),
      createDisplayWindowsPresentationContext(windows, 10),
      zh,
      new Set([102]),
    )

    expect(result[0].tabs.map((tab) => tab.id)).toEqual([102, 101])
    expect(result[1].tabs.map((tab) => tab.id)).toEqual([201])
  })

  it('uses window focused state to order and label a different focused window', () => {
    const input = windows.map((window) => ({
      ...window,
      focused: window.id === 20,
      tabs: [...window.tabs],
    }))

    const result = createDisplayWindows(
      input,
      false,
      new Map(),
      createDisplayWindowsPresentationContext(input, 20), zh
    )

    expect(result.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 20, label: '当前窗口' },
      { id: 10, label: '窗口 2' },
    ])
  })

  it('keeps the original background label when only that window survives filtering', () => {
    const filtered = filterWindows(windows, {
      query: 'documentation',
      filter: 'all',
      focusedWindowId: 10,
    })

    const result = createDisplayWindows(
      filtered,
      false,
      new Map(),
      createDisplayWindowsPresentationContext(windows, 10), zh
    )

    expect(result.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 20, label: '窗口 2' },
    ])
  })

  it('keeps original numbering when an intermediate background window is filtered out', () => {
    const originalWindows = [
      windows[0],
      {
        ...windows[1],
        tabs: windows[1].tabs.map((tab) => ({ ...tab, active: false })),
      },
      backgroundWindow30,
    ]
    const filtered = filterWindows(originalWindows, {
      query: '',
      filter: 'active',
      focusedWindowId: 10,
    })

    const result = createDisplayWindows(
      filtered,
      false,
      new Map(),
      createDisplayWindowsPresentationContext(originalWindows, 10), zh
    )

    expect(result.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 10, label: '当前窗口' },
      { id: 30, label: '窗口 3' },
    ])
  })

  it('replaces masked display fields and omits private values from serialized display output', () => {
    const privateTab = windows[0].tabs[0]
    const isolatedWindow = [{ ...windows[0], tabs: [privateTab] }]

    const [displayWindow] = createDisplayWindows(
      isolatedWindow,
      true,
      new Map(),
      createDisplayWindowsPresentationContext(isolatedWindow, 10), zh
    )
    const [displayTab] = displayWindow.tabs
    const serialized = JSON.stringify(displayWindow)

    expect(displayTab.masked).toBe(true)
    expect(displayTab.displayTitle).toBe('内容已隐藏')
    expect(displayTab.displayUrl).toBe('')
    expect(displayTab.displayFavIconUrl).toBeUndefined()
    expect(displayTab).not.toHaveProperty('title')
    expect(displayTab).not.toHaveProperty('url')
    expect(displayTab).not.toHaveProperty('favIconUrl')
    expect(serialized).not.toContain(privateTab.title)
    expect(serialized).not.toContain(privateTab.url)
    expect(serialized).not.toContain(privateTab.favIconUrl)
  })

  it('preserves title and URL while replacing remote favicons with the local Chrome favicon service', () => {
    const sourceTab = windows[0].tabs[0]
    const [displayWindow] = createDisplayWindows(
      windows,
      false,
      new Map(),
      createDisplayWindowsPresentationContext(windows, 10), zh
    )
    const displayTab = displayWindow.tabs[0]

    expect(displayTab).toMatchObject({
      id: sourceTab.id,
      windowId: sourceTab.windowId,
      index: sourceTab.index,
      active: sourceTab.active,
      masked: false,
      displayTitle: sourceTab.title,
      displayUrl: sourceTab.url,
      displayFavIconUrl: `/_favicon/?pageUrl=${encodeURIComponent(sourceTab.url)}&size=32`,
    })
    expect(displayTab).not.toHaveProperty('title')
    expect(displayTab).not.toHaveProperty('url')
    expect(displayTab).not.toHaveProperty('favIconUrl')
  })

  it('serializes a per-tab masked override without private values under global unmasked state', () => {
    const privateTab = windows[0].tabs[1]
    const result = createDisplayWindows(
      windows,
      false,
      new Map([[privateTab.id, true]]),
      createDisplayWindowsPresentationContext(windows, 10), zh
    )
    const displayTab = result
      .flatMap((window) => window.tabs)
      .find((tab) => tab.id === privateTab.id)

    expect(displayTab).toEqual({
      id: privateTab.id,
      windowId: privateTab.windowId,
      index: privateTab.index,
      active: privateTab.active,
      masked: true,
      displayTitle: '内容已隐藏',
      displayUrl: '',
      displayFavIconUrl: undefined,
    })

    const serialized = JSON.stringify(displayTab)
    expect(serialized).not.toContain(privateTab.title)
    expect(serialized).not.toContain(privateTab.url)
    expect(serialized).not.toContain(privateTab.favIconUrl)
  })

  it('applies per-tab overrides without mutating the source data', () => {
    const snapshot = structuredClone(windows)
    const result = createDisplayWindows(
      windows,
      true,
      new Map([[101, false]]),
      createDisplayWindowsPresentationContext(windows, 10), zh
    )

    expect(result[0].tabs[0].masked).toBe(false)
    expect(result[0].tabs[1].masked).toBe(true)
    expect(windows).toEqual(snapshot)
  })
})

describe('registrable domain grouping', () => {
  it.each([
    ['https://docs.google.com/document/1', 'google.com'],
    ['https://drive.google.com/drive', 'google.com'],
    ['https://www.google.com/search', 'google.com'],
    ['https://xaa.bac.google.com/path', 'google.com'],
    ['https://docs.example.com.cn/path', 'example.com.cn'],
    ['https://alice.github.io/project', 'alice.github.io'],
    ['https://bob.github.io/project', 'bob.github.io'],
    ['https://alice.blogspot.com/post', 'alice.blogspot.com'],
    ['https://bob.blogspot.com/post', 'bob.blogspot.com'],
    ['https://bucket-a.s3.amazonaws.com/object', 'bucket-a.s3.amazonaws.com'],
    ['https://bucket-b.s3.amazonaws.com/object', 'bucket-b.s3.amazonaws.com'],
    ['http://localhost:5173/path', 'localhost'],
    ['http://127.0.0.1:8080/path', '127.0.0.1'],
    ['http://[2001:db8::1]:8080/path', '2001:db8::1'],
    ['chrome://settings/privacy', 'chrome://settings'],
    [
      'chrome-extension://abcdefghijklmnop/options.html',
      'chrome-extension://abcdefghijklmnop',
    ],
    ['file:///Users/example/private.txt', 'file://'],
    ['not a valid URL', 'other'],
  ])('projects %s to the stable group key %s', (url, expected) => {
    expect(getTabDomainGroupKey(url)).toBe(expected)
  })

  it('groups filtered tabs across windows in deterministic first-seen order', () => {
    const groupedWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...windows[0].tabs[0], id: 1, url: 'https://docs.google.com/a' },
          { ...windows[0].tabs[1], id: 2, url: 'https://alpha.example.com/a' },
        ],
      },
      {
        id: 20,
        focused: false,
        tabs: [
          { ...windows[1].tabs[0], id: 3, url: 'https://drive.google.com/b' },
          { ...windows[1].tabs[0], id: 4, url: 'https://beta.example.com/b' },
          { ...windows[1].tabs[0], id: 5, url: 'chrome://settings/privacy' },
        ],
      },
    ]

    const result = createDisplayDomainGroups(groupedWindows, false, new Map(), zh)

    expect(
      result.map(({ label, tabs }) => ({
        label,
        ids: tabs.map((tab) => tab.id),
      })),
    ).toEqual([
      { label: 'google.com', ids: [1, 3] },
      { label: 'example.com', ids: [2, 4] },
      { label: 'chrome://settings', ids: [5] },
    ])
    expect(new Set(result.map((group) => group.key))).toHaveLength(3)
    expect(result.every((group) => /^domain-group-\d+$/.test(group.key))).toBe(
      true,
    )
  })

  it('stably sorts pinned groups and pinned tabs first without exposing raw pin keys', () => {
    const result = createDisplayDomainGroups(
      windows,
      true,
      new Map(),
      zh,
      new Set([201]),
      new Set(['example.com']),
    )

    expect(result.map((group) => group.tabs.map((tab) => tab.id))).toEqual([
      [201, 102],
      [101],
    ])
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('example.com')
    expect(serialized).not.toContain('github.com')
    expect(serialized).not.toContain('pinnedDomainKeys')
  })

  it('exposes whether all effective tabs in a display domain group are masked', () => {
    expect(displayDomainGroupHasAllMasked).toBe(true)

    const result = createDisplayDomainGroups(
      [
        {
          id: 10,
          focused: true,
          tabs: [
            { ...windows[0].tabs[0], id: 1, url: 'https://docs.google.com/a' },
            { ...windows[0].tabs[1], id: 2, url: 'https://drive.google.com/b' },
          ],
        },
      ],
      false,
      new Map([[1, true]]), zh
    )

    expect(result[0]).toMatchObject({
      label: 'google.com',
      allMasked: false,
      tabs: [{ id: 1, masked: true }, { id: 2, masked: false }],
    })

    const allMasked = createDisplayDomainGroups(
      [
        {
          id: 10,
          focused: true,
          tabs: [
            { ...windows[0].tabs[0], id: 1, url: 'https://docs.google.com/a' },
            { ...windows[0].tabs[1], id: 2, url: 'https://drive.google.com/b' },
          ],
        },
      ],
      false,
      new Map([
        [1, true],
        [2, true],
      ]), zh
    )

    expect(allMasked[0]).toMatchObject({
      label: '网站分组 1',
      allMasked: true,
    })
  })

  it('uses the existing DisplayTab privacy projection and hides domain labels globally', () => {
    const privateWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          {
            ...windows[0].tabs[0],
            id: 1,
            title: 'Private Google document',
            url: 'https://docs.google.com/private?token=secret',
          },
          {
            ...windows[0].tabs[1],
            id: 2,
            title: 'Private Example page',
            url: 'https://private.example.com/account',
          },
        ],
      },
    ]

    const result = createDisplayDomainGroups(privateWindows, true, new Map(), zh)
    const serialized = JSON.stringify(result)

    expect(result.map((group) => group.label)).toEqual([
      '网站分组 1',
      '网站分组 2',
    ])
    expect(new Set(result.map((group) => group.key))).toHaveLength(2)
    expect(result.every((group) => /^domain-group-\d+$/.test(group.key))).toBe(
      true,
    )
    expect(
      result.flatMap((group) => group.tabs).every((tab) => tab.masked),
    ).toBe(true)
    expect(serialized).not.toContain('google.com')
    expect(serialized).not.toContain('example.com')
    expect(serialized).not.toContain('Private Google document')
    expect(serialized).not.toContain('token=secret')
  })

  it('keeps private-suffix tenants in independent groups', () => {
    const privateTenantWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...windows[0].tabs[0], id: 11, url: 'https://alice.github.io/a' },
          { ...windows[0].tabs[1], id: 12, url: 'https://bob.github.io/b' },
          { ...windows[0].tabs[0], id: 13, url: 'https://alice.blogspot.com/a' },
          { ...windows[0].tabs[1], id: 14, url: 'https://bob.blogspot.com/b' },
          {
            ...windows[0].tabs[0],
            id: 15,
            url: 'https://bucket-a.s3.amazonaws.com/a',
          },
          {
            ...windows[0].tabs[1],
            id: 16,
            url: 'https://bucket-b.s3.amazonaws.com/b',
          },
        ],
      },
    ]

    const result = createDisplayDomainGroups(
      privateTenantWindows,
      false,
      new Map(), zh
    )

    expect(result.map((group) => group.label)).toEqual([
      'alice.github.io',
      'bob.github.io',
      'alice.blogspot.com',
      'bob.blogspot.com',
      'bucket-a.s3.amazonaws.com',
      'bucket-b.s3.amazonaws.com',
    ])
    expect(result.map((group) => group.tabs.map((tab) => tab.id))).toEqual([
      [11],
      [12],
      [13],
      [14],
      [15],
      [16],
    ])
  })

  it('uses effective per-tab masks to hide a single private-domain group label', () => {
    const privateTab = {
      ...windows[0].tabs[0],
      id: 71,
      title: 'Private tenant title',
      url: 'https://secret-tenant.github.io/private?token=secret',
    }
    const result = createDisplayDomainGroups(
      [{ id: 10, focused: true, tabs: [privateTab] }],
      false,
      new Map([[privateTab.id, true]]), zh
    )
    const serialized = JSON.stringify(result)

    expect(result).toMatchObject([
      {
        label: '网站分组 1',
        tabs: [{ id: 71, masked: true }],
      },
    ])
    expect(result[0].key).toMatch(/^domain-group-\d+$/)
    expect(serialized).not.toContain('secret-tenant.github.io')
    expect(serialized).not.toContain('Private tenant title')
    expect(serialized).not.toContain('token=secret')
  })

  it('hides an all-masked group label but reveals it when any row is effectively visible', () => {
    const sameDomainTabs = [
      {
        ...windows[0].tabs[0],
        id: 81,
        url: 'https://docs.google.com/private-a',
      },
      {
        ...windows[0].tabs[1],
        id: 82,
        url: 'https://drive.google.com/private-b',
      },
    ]
    const input = [{ id: 10, focused: true, tabs: sameDomainTabs }]

    const allMasked = createDisplayDomainGroups(
      input,
      false,
      new Map([
        [81, true],
        [82, true],
      ]), zh
    )
    expect(allMasked[0]).toMatchObject({
      label: '网站分组 1',
    })
    expect(allMasked[0].key).toMatch(/^domain-group-\d+$/)
    expect(JSON.stringify(allMasked)).not.toContain('google.com')

    const oneVisible = createDisplayDomainGroups(
      input,
      true,
      new Map([[82, false]]), zh
    )
    expect(oneVisible[0]).toMatchObject({
      key: allMasked[0].key,
      label: 'google.com',
      tabs: [{ id: 81, masked: true }, { id: 82, masked: false }],
    })
  })

  it('keeps the same opaque key when the first member of a domain group is filtered out', () => {
    const sameDomainWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          {
            ...windows[0].tabs[0],
            id: 101,
            url: 'https://docs.google.com/first',
          },
          {
            ...windows[0].tabs[1],
            id: 102,
            url: 'https://drive.google.com/second?token=secret',
          },
        ],
      },
    ]

    const allGroups = createDisplayDomainGroups(
      sameDomainWindows,
      true,
      new Map(), zh
    )
    const onlySecondTabGroups = createDisplayDomainGroups(
      [{ ...sameDomainWindows[0], tabs: [sameDomainWindows[0].tabs[1]] }],
      true,
      new Map(), zh
    )
    const firstKey = allGroups[0].key

    expect(onlySecondTabGroups[0].key).toBe(firstKey)
    expect(firstKey).not.toContain('google.com')
    expect(firstKey).not.toContain('docs.google.com')
    expect(firstKey).not.toContain('drive.google.com')
    expect(firstKey).not.toContain('https://')
    expect(firstKey).not.toContain('token=secret')
    expect(JSON.stringify(onlySecondTabGroups)).not.toContain('drive.google.com')
  })

  it('uses a stable opaque first-member key that cannot transfer to another filtered domain', () => {
    const input: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...windows[0].tabs[0], id: 91, url: 'https://docs.google.com/a' },
          { ...windows[0].tabs[1], id: 92, url: 'https://example.com/a' },
        ],
      },
    ]

    const allGroups = createDisplayDomainGroups(input, true, new Map(), zh)
    const filteredGroups = createDisplayDomainGroups(
      [{ ...input[0], tabs: [input[0].tabs[1]] }],
      true,
      new Map(), zh
    )

    expect(allGroups[0].key).toMatch(/^domain-group-\d+$/)
    expect(allGroups[1].key).toMatch(/^domain-group-\d+$/)
    expect(allGroups[1].key).not.toBe(allGroups[0].key)
    expect(filteredGroups[0].key).toBe(allGroups[1].key)
    expect(filteredGroups[0].key).not.toBe(allGroups[0].key)
    expect(JSON.stringify(allGroups)).not.toContain('google.com')
    expect(JSON.stringify(allGroups)).not.toContain('example.com')
  })
})
