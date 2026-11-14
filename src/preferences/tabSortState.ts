import type { TabSortStep } from '../types'

export const TAB_SORT_STATE_KEY = 'chrome-tabs.tab-sort-state.v1'
const TAB_SORT_STATE_VERSION = 1

/**
 * The popup closes as soon as it loses focus, so the pre-sort tab order must
 * outlive it for the restore step. Only numeric tab and window ids are stored.
 */
export interface TabSortState {
  nextStep: TabSortStep
  originalOrder: ReadonlyMap<number, readonly number[]> | null
}

interface StoredTabSortState {
  version: typeof TAB_SORT_STATE_VERSION
  nextStep: TabSortStep
  originalOrder: Array<[number, number[]]>
}

interface TabSortStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const initialTabSortState: TabSortState = { nextStep: 'asc', originalOrder: null }

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

function isOriginalOrder(value: unknown): value is Array<[number, number[]]> {
  return Array.isArray(value) && value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      isNonNegativeInteger(entry[0]) &&
      Array.isArray(entry[1]) &&
      entry[1].every(isNonNegativeInteger),
  )
}

function parseStoredState(value: string): TabSortState | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<StoredTabSortState>
    if (
      candidate.version !== TAB_SORT_STATE_VERSION ||
      (candidate.nextStep !== 'desc' && candidate.nextStep !== 'restore') ||
      !isOriginalOrder(candidate.originalOrder)
    ) return null

    return {
      nextStep: candidate.nextStep,
      originalOrder: new Map(candidate.originalOrder),
    }
  } catch {
    return null
  }
}

function getDefaultStorage(): TabSortStorage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

export function loadTabSortState(
  storage: TabSortStorage | undefined = getDefaultStorage(),
): TabSortState {
  if (!storage) return { ...initialTabSortState }
  try {
    const storedValue = storage.getItem(TAB_SORT_STATE_KEY)
    return storedValue
      ? (parseStoredState(storedValue) ?? { ...initialTabSortState })
      : { ...initialTabSortState }
  } catch {
    return { ...initialTabSortState }
  }
}

export function saveTabSortState(
  state: TabSortState,
  storage: TabSortStorage | undefined = getDefaultStorage(),
): void {
  if (!storage) return
  try {
    if (state.nextStep === 'asc' || !state.originalOrder) {
      storage.removeItem(TAB_SORT_STATE_KEY)
      return
    }
    const storedState: StoredTabSortState = {
      version: TAB_SORT_STATE_VERSION,
      nextStep: state.nextStep,
      originalOrder: [...state.originalOrder].map(
        ([windowId, tabIds]) => [windowId, [...tabIds]],
      ),
    }
    storage.setItem(TAB_SORT_STATE_KEY, JSON.stringify(storedState))
  } catch {
    // Sort state is best-effort and must never prevent the popup from loading.
  }
}
