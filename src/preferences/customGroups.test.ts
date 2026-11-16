import { beforeEach, describe, expect, it } from 'vitest'
import { CUSTOM_GROUPS_KEY, loadCustomGroups, saveCustomGroups } from './customGroups'

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
