import { normalizeCustomGroupName } from '../domain/customGroups'
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

  return {
    id: candidate.id,
    name,
    urls: [...new Set(candidate.urls.filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    ))],
    ...(candidate.pinned === true ? { pinned: true } : {}),
  }
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
