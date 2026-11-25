import { normalizeCustomGroupName, normalizeSavedTabTitle } from '../domain/customGroups'
import type { CustomTabGroup } from '../types'

export const CUSTOM_GROUPS_KEY = 'chrome-tabs.custom-groups.v1'
const CUSTOM_GROUPS_VERSION = 1

interface StoredCustomGroups {
  version: typeof CUSTOM_GROUPS_VERSION
  groups: CustomTabGroup[]
}

interface CustomGroupsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function parseGroup(value: unknown): CustomTabGroup | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<CustomTabGroup>
  const name = typeof candidate.name === 'string'
    ? normalizeCustomGroupName(candidate.name)
    : ''
  if (
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    !name ||
    !Array.isArray(candidate.urls)
  ) return null

  const urls = [...new Set(candidate.urls.filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  ))]
  const titles = parseTitles(candidate.titles, urls)
  return {
    id: candidate.id,
    name,
    urls,
    ...(titles ? { titles } : {}),
    ...(candidate.pinned === true ? { pinned: true } : {}),
  }
}

/** Keeps string titles of saved URLs only; groups saved before titles existed have none. */
function parseTitles(value: unknown, urls: readonly string[]): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const entries = urls.flatMap((url) => {
    const title = Object.prototype.hasOwnProperty.call(record, url) ? record[url] : undefined
    const normalized = typeof title === 'string' ? normalizeSavedTabTitle(title) : ''
    return normalized ? [[url, normalized] as const] : []
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function getDefaultStorage(): CustomGroupsStorage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

export function loadCustomGroups(
  storage: CustomGroupsStorage | undefined = getDefaultStorage(),
): CustomTabGroup[] {
  try {
    const storedValue = storage?.getItem(CUSTOM_GROUPS_KEY)
    if (!storedValue) return []
    const parsed: unknown = JSON.parse(storedValue)
    if (typeof parsed !== 'object' || parsed === null) return []
    const candidate = parsed as Partial<StoredCustomGroups>
    if (candidate.version !== CUSTOM_GROUPS_VERSION || !Array.isArray(candidate.groups)) {
      return []
    }

    const seenIds = new Set<string>()
    return candidate.groups.flatMap((value) => {
      const group = parseGroup(value)
      if (!group || seenIds.has(group.id)) return []
      seenIds.add(group.id)
      return [group]
    })
  } catch {
    return []
  }
}

export function saveCustomGroups(
  groups: readonly CustomTabGroup[],
  storage: CustomGroupsStorage | undefined = getDefaultStorage(),
): void {
  if (!storage) return
  const storedGroups: StoredCustomGroups = {
    version: CUSTOM_GROUPS_VERSION,
    groups: [...groups],
  }
  try { storage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(storedGroups)) } catch {
    // Custom groups are best-effort and must never prevent the popup from loading.
  }
}

export const CUSTOM_GROUP_COLLAPSE_KEY = 'chrome-tabs.custom-group-collapse.v1'

/**
 * Loads which custom group sections are collapsed. Keys are group ids, plus
 * the built-in ungrouped section key; unknown or malformed entries are dropped.
 */
export function loadCollapsedCustomGroupKeys(
  validKeys: ReadonlySet<string>,
  storage: CustomGroupsStorage | undefined = getDefaultStorage(),
): Set<string> {
  try {
    const storedValue = storage?.getItem(CUSTOM_GROUP_COLLAPSE_KEY)
    if (!storedValue) return new Set()
    const parsed: unknown = JSON.parse(storedValue)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter(
      (key): key is string => typeof key === 'string' && validKeys.has(key),
    ))
  } catch {
    return new Set()
  }
}

export function saveCollapsedCustomGroupKeys(
  keys: ReadonlySet<string>,
  storage: CustomGroupsStorage | undefined = getDefaultStorage(),
): void {
  if (!storage) return
  try { storage.setItem(CUSTOM_GROUP_COLLAPSE_KEY, JSON.stringify([...keys])) } catch {
    // Collapse state is best-effort and must never prevent the popup from loading.
  }
}
