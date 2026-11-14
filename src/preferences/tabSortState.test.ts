import { beforeEach, describe, expect, it } from 'vitest'
import {
  TAB_SORT_STATE_KEY,
  loadTabSortState,
  saveTabSortState,
} from './tabSortState'

beforeEach(() => {
  localStorage.clear()
})

describe('tab sort state', () => {
  it('starts with ascending sort and no recorded order', () => {
    expect(loadTabSortState()).toEqual({ nextStep: 'asc', originalOrder: null })
  })

  it('round-trips the next step and recorded tab order', () => {
    saveTabSortState({
      nextStep: 'restore',
      originalOrder: new Map([[10, [3, 1, 2]], [20, [4]]]),
    })

    expect(JSON.parse(localStorage.getItem(TAB_SORT_STATE_KEY)!)).toEqual({
      version: 1,
      nextStep: 'restore',
      originalOrder: [[10, [3, 1, 2]], [20, [4]]],
    })
    expect(loadTabSortState()).toEqual({
      nextStep: 'restore',
      originalOrder: new Map([[10, [3, 1, 2]], [20, [4]]]),
    })
  })

  it('clears stored state once the cycle returns to ascending', () => {
    saveTabSortState({ nextStep: 'desc', originalOrder: new Map([[10, [1]]]) })
    saveTabSortState({ nextStep: 'asc', originalOrder: null })

    expect(localStorage.getItem(TAB_SORT_STATE_KEY)).toBeNull()
  })

  it.each([
    'not json',
    JSON.stringify({ version: 2, nextStep: 'desc', originalOrder: [] }),
    JSON.stringify({ version: 1, nextStep: 'asc', originalOrder: [] }),
    JSON.stringify({ version: 1, nextStep: 'restore' }),
    JSON.stringify({ version: 1, nextStep: 'restore', originalOrder: [[10, ['1']]] }),
    JSON.stringify({ version: 1, nextStep: 'restore', originalOrder: [[-1, [1]]] }),
  ])('falls back to the initial state for invalid data %s', (value) => {
    localStorage.setItem(TAB_SORT_STATE_KEY, value)
    expect(loadTabSortState()).toEqual({ nextStep: 'asc', originalOrder: null })
  })

  it('ignores storage failures', () => {
    const storage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }

    expect(loadTabSortState(storage)).toEqual({ nextStep: 'asc', originalOrder: null })
    expect(() => saveTabSortState(
      { nextStep: 'desc', originalOrder: new Map() },
      storage,
    )).not.toThrow()
  })
})
