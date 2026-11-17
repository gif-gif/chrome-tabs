import { describe, expect, it } from 'vitest'
import { createTranslator } from '../i18n/i18n'
import { windows } from '../test/fixtures'
import type { CustomTabGroup } from '../types'
import {
  addCustomGroup,
  createDisplayCustomGroups,
  deleteCustomGroup,
  listSelectableTabs,
  moveCustomGroup,
  orderCustomGroups,
  reorderCustomGroup,
  toggleCustomGroupPin,
  normalizeCustomGroupName,
  renameCustomGroup,
  toggleCustomGroupUrl,
  UNGROUPED_CUSTOM_GROUP_KEY,
} from './customGroups'

const t = createTranslator('zh-CN')
const githubUrl = 'https://github.com/example/chrome-tabs'
const mailUrl = 'https://mail.example.com/inbox?TOKEN=SECRET'
const docsUrl = 'https://docs.example.com/project/overview'

describe('custom group editing', () => {
  it('normalizes names and rejects blank ones', () => {
    expect(normalizeCustomGroupName('  Work   stuff ')).toBe('Work stuff')
    expect(normalizeCustomGroupName('x'.repeat(60))).toHaveLength(40)
    expect(addCustomGroup([], 'a', '   ')).toEqual([])
  })

  it('adds, renames, and deletes groups without mutating the input', () => {
    const initial: CustomTabGroup[] = []
    const added = addCustomGroup(initial, 'a', ' 工作 ')
    expect(added).toEqual([{ id: 'a', name: '工作', urls: [] }])
    expect(initial).toEqual([])

    expect(addCustomGroup(added, 'a', 'dup')).toEqual(added)
    expect(renameCustomGroup(added, 'a', '学习')).toEqual([{ id: 'a', name: '学习', urls: [] }])
    expect(renameCustomGroup(added, 'a', '  ')).toEqual(added)
    expect(deleteCustomGroup(added, 'a')).toEqual([])
  })

  it('toggles a URL in only the targeted group', () => {
    const groups = [
      { id: 'a', name: 'A', urls: [githubUrl] },
      { id: 'b', name: 'B', urls: [] },
    ]
    expect(toggleCustomGroupUrl(groups, 'b', githubUrl)).toEqual([
      { id: 'a', name: 'A', urls: [githubUrl] },
      { id: 'b', name: 'B', urls: [githubUrl] },
    ])
    expect(toggleCustomGroupUrl(groups, 'a', githubUrl)[0].urls).toEqual([])
    expect(toggleCustomGroupUrl(groups, 'a', '')).toEqual(groups)
  })
})

describe('moveCustomGroup', () => {
  const groups = ['a', 'b', 'c'].map((id) => ({ id, name: id, urls: [] }))
  const ids = (result: CustomTabGroup[]) => result.map((group) => group.id)

  it('swaps a group with its neighbour without mutating the input', () => {
    expect(ids(moveCustomGroup(groups, 'b', -1))).toEqual(['b', 'a', 'c'])
    expect(ids(moveCustomGroup(groups, 'b', 1))).toEqual(['a', 'c', 'b'])
    expect(ids(groups)).toEqual(['a', 'b', 'c'])
  })

  it('ignores moves past either end and unknown ids', () => {
    expect(ids(moveCustomGroup(groups, 'a', -1))).toEqual(['a', 'b', 'c'])
    expect(ids(moveCustomGroup(groups, 'c', 1))).toEqual(['a', 'b', 'c'])
    expect(ids(moveCustomGroup(groups, 'x', 1))).toEqual(['a', 'b', 'c'])
  })
})

describe('custom group pinning', () => {
  const ids = (result: CustomTabGroup[]) => result.map((group) => group.id)
  const groups: CustomTabGroup[] = [
    { id: 'a', name: 'a', urls: [] },
    { id: 'b', name: 'b', urls: [], pinned: true },
    { id: 'c', name: 'c', urls: [] },
    { id: 'd', name: 'd', urls: [], pinned: true },
  ]

  it('lists pinned groups first, keeping saved order within each part', () => {
    expect(ids(orderCustomGroups(groups))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('toggles a group pin and keeps the saved order stable', () => {
    const pinned = toggleCustomGroupPin(groups, 'c')
    expect(ids(pinned)).toEqual(['a', 'b', 'c', 'd'])
    expect(pinned.find((group) => group.id === 'c')?.pinned).toBe(true)
    expect(ids(orderCustomGroups(pinned))).toEqual(['b', 'c', 'd', 'a'])
    expect(ids(orderCustomGroups(toggleCustomGroupPin(groups, 'b')))).toEqual(['d', 'a', 'b', 'c'])
    expect(groups.find((group) => group.id === 'c')?.pinned).toBeUndefined()
  })

  it('moves groups only within their pinned or unpinned part', () => {
    expect(ids(moveCustomGroup(groups, 'd', -1))).toEqual(['d', 'b', 'a', 'c'])
    expect(ids(moveCustomGroup(groups, 'd', 1))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(moveCustomGroup(groups, 'a', -1))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('drops a dragged group at the target position within its part', () => {
    const many: CustomTabGroup[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, urls: [] }))
    expect(ids(reorderCustomGroup(many, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd'])
    expect(ids(reorderCustomGroup(many, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c'])
    expect(ids(reorderCustomGroup(many, 'a', 'a'))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(reorderCustomGroup(many, 'x', 'a'))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(many)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores drops across the pinned boundary', () => {
    expect(ids(reorderCustomGroup(groups, 'a', 'b'))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(reorderCustomGroup(groups, 'd', 'b'))).toEqual(['d', 'b', 'a', 'c'])
  })

  it('exposes pin state in display order', () => {
    const result = createDisplayCustomGroups([], groups, false, new Map(), t)
    expect(result.map(({ key, pinned }) => [key, pinned])).toEqual([
      ['b', true],
      ['d', true],
      ['a', false],
      ['c', false],
    ])
  })
})

describe('listSelectableTabs', () => {
  it('returns one tab per distinct URL in window order', () => {
    const duplicate = { ...windows[1].tabs[0], id: 999, url: githubUrl }
    const input = [windows[0], { ...windows[1], tabs: [...windows[1].tabs, duplicate] }]
    expect(listSelectableTabs(input).map((tab) => tab.id)).toEqual([101, 102, 201])
  })
})

describe('createDisplayCustomGroups', () => {
  it('lists the selected tabs per group and collects the rest as ungrouped', () => {
    const groups = [
      { id: 'work', name: '工作', urls: [githubUrl, docsUrl, 'https://closed.example.com'] },
      { id: 'mail', name: '邮件', urls: [mailUrl, githubUrl] },
    ]
    const result = createDisplayCustomGroups(windows, groups, false, new Map(), t)

    expect(result.map((group) => [group.key, group.label, group.tabs.map((tab) => tab.id)])).toEqual([
      ['work', '工作', [101, 201]],
      ['mail', '邮件', [101, 102]],
    ])
    expect(result[0].savedUrlCount).toBe(3)
  })

  it('appends an ungrouped section only when some tabs are not in any group', () => {
    const result = createDisplayCustomGroups(
      windows,
      [{ id: 'work', name: '工作', urls: [githubUrl] }],
      false,
      new Map(),
      t,
    )
    expect(result.at(-1)).toMatchObject({
      key: UNGROUPED_CUSTOM_GROUP_KEY,
      label: '未分组',
      savedUrlCount: 0,
    })
    expect(result.at(-1)?.tabs.map((tab) => tab.id)).toEqual([102, 201])
  })

  it('keeps group names but hides tab details when masked', () => {
    const [group] = createDisplayCustomGroups(
      windows,
      [{ id: 'work', name: '工作', urls: [githubUrl] }],
      true,
      new Map(),
      t,
    )
    expect(group.label).toBe('工作')
    expect(group.allMasked).toBe(true)
    expect(group.tabs[0]).toMatchObject({ displayTitle: '内容已隐藏', displayUrl: '' })
    expect(group.tabs[0].displayFavIconUrl).toBeUndefined()
  })

  it('puts pinned tabs first and keeps empty groups', () => {
    const result = createDisplayCustomGroups(
      windows,
      [
        { id: 'work', name: '工作', urls: [githubUrl, mailUrl] },
        { id: 'empty', name: '空', urls: [] },
      ],
      false,
      new Map(),
      t,
      new Set([102]),
    )
    expect(result[0].tabs.map((tab) => tab.id)).toEqual([102, 101])
    expect(result[1]).toMatchObject({ key: 'empty', tabs: [], allMasked: false })
  })
})
