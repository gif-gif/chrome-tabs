import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_GROUP_COLLAPSE_KEY,
  CUSTOM_GROUPS_KEY,
  loadCollapsedCustomGroupKeys,
  loadCustomGroups,
  saveCollapsedCustomGroupKeys,
  saveCustomGroups,
} from './customGroups'

beforeEach(() => {
  localStorage.clear()
})

describe('custom groups storage', () => {
  it('starts empty', () => {
    expect(loadCustomGroups()).toEqual([])
  })

  it('round-trips groups in order', () => {
    const groups = [
      { id: 'b', name: '学习', urls: ['https://b.example'] },
      { id: 'a', name: 'Work', urls: [] },
    ]
    saveCustomGroups(groups)
    expect(JSON.parse(localStorage.getItem(CUSTOM_GROUPS_KEY)!)).toEqual({ version: 1, groups })
    expect(loadCustomGroups()).toEqual(groups)
  })

  it('reads groups saved before titles were kept, and round-trips saved titles', () => {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify({
      version: 1,
      groups: [{ id: 'old', name: 'Old', urls: ['https://a.example/'], pinned: true }],
    }))
    expect(loadCustomGroups()).toEqual([
      { id: 'old', name: 'Old', urls: ['https://a.example/'], pinned: true },
    ])

    const groups = [{
      id: 'new',
      name: 'New',
      urls: ['https://a.example/', 'https://b.example/'],
      titles: { 'https://a.example/': 'Page A' },
    }]
    saveCustomGroups(groups)
    expect(loadCustomGroups()).toEqual(groups)
  })

  it('drops malformed titles and titles of URLs the group no longer saves', () => {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify({
      version: 1,
      groups: [
        { id: 'a', name: 'A', urls: ['https://a/'], titles: { 'https://a/': '  Page   A ', 'https://gone/': 'Gone' } },
        { id: 'b', name: 'B', urls: ['https://b/'], titles: { 'https://b/': 7 } },
        { id: 'c', name: 'C', urls: ['https://c/'], titles: ['nope'] },
      ],
    }))
    expect(loadCustomGroups()).toEqual([
      { id: 'a', name: 'A', urls: ['https://a/'], titles: { 'https://a/': 'Page A' } },
      { id: 'b', name: 'B', urls: ['https://b/'] },
      { id: 'c', name: 'C', urls: ['https://c/'] },
    ])
  })

  it('drops invalid groups, duplicate ids, and invalid or repeated URLs', () => {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify({
      version: 1,
      groups: [
        { id: 'a', name: '  A  ', urls: ['https://a', 'https://a', '', 3] },
        { id: 'a', name: 'dup', urls: [] },
        { id: '', name: 'no id', urls: [] },
        { id: 'b', name: '   ', urls: [] },
        { id: 'c', name: 'C' },
        null,
      ],
    }))
    expect(loadCustomGroups()).toEqual([{ id: 'a', name: 'A', urls: ['https://a'] }])
  })

  it.each(['not json', JSON.stringify({ version: 2, groups: [] }), JSON.stringify({ version: 1 })])(
    'falls back to no groups for %s',
    (value) => {
      localStorage.setItem(CUSTOM_GROUPS_KEY, value)
      expect(loadCustomGroups()).toEqual([])
    },
  )

  it('keeps only a true pinned flag', () => {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify({
      version: 1,
      groups: [
        { id: 'a', name: 'A', urls: [], pinned: true },
        { id: 'b', name: 'B', urls: [], pinned: 'yes' },
      ],
    }))
    expect(loadCustomGroups()).toEqual([
      { id: 'a', name: 'A', urls: [], pinned: true },
      { id: 'b', name: 'B', urls: [] },
    ])
  })

  it('ignores storage failures', () => {
    const storage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }
    expect(loadCustomGroups(storage)).toEqual([])
    expect(() => saveCustomGroups([], storage)).not.toThrow()
  })
})

describe('custom group collapse storage', () => {
  it('round-trips collapsed keys and drops keys of deleted groups', () => {
    saveCollapsedCustomGroupKeys(new Set(['a', 'gone', 'custom-ungrouped']))
    expect(JSON.parse(localStorage.getItem(CUSTOM_GROUP_COLLAPSE_KEY)!)).toEqual(['a', 'gone', 'custom-ungrouped'])
    expect(loadCollapsedCustomGroupKeys(new Set(['a', 'b', 'custom-ungrouped'])))
      .toEqual(new Set(['a', 'custom-ungrouped']))
  })

  it.each(['not json', '{"a":1}', '[1, null]'])('falls back to nothing collapsed for %s', (value) => {
    localStorage.setItem(CUSTOM_GROUP_COLLAPSE_KEY, value)
    expect(loadCollapsedCustomGroupKeys(new Set(['a']))).toEqual(new Set())
  })

  it('ignores storage failures', () => {
    const storage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }
    expect(loadCollapsedCustomGroupKeys(new Set(['a']), storage)).toEqual(new Set())
    expect(() => saveCollapsedCustomGroupKeys(new Set(['a']), storage)).not.toThrow()
  })
})
