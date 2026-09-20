import { useId } from 'react'
import type { Translator } from '../i18n/i18n'
import type { DisplayDomainGroup, DisplayTab } from '../types'
import { Icon } from './Icon'
import { TabRow } from './TabRow'

interface DomainGroupProps {
  group: DisplayDomainGroup
  pinned?: boolean
  collapsed: boolean
  duplicateCount?: number
  onToggleCollapse: (groupKey: string) => void
  onToggleGroupPin?: (group: DisplayDomainGroup) => void
  onRemoveDuplicates?: (group: DisplayDomainGroup) => void
  onToggleGroupMask: (group: DisplayDomainGroup) => void
  onCloseGroup: (group: DisplayDomainGroup) => void
  onActivate: (tab: DisplayTab) => void
  onTogglePin?: (tab: DisplayTab) => void
  onToggleFavorite?: (tab: DisplayTab) => void
  onToggleMask: (tab: DisplayTab) => void
  onCopy: (tab: DisplayTab) => void
  onClose: (tab: DisplayTab) => void
  t: Translator
  pinnedTabIds?: ReadonlySet<number>
  favoriteTabIds?: ReadonlySet<number>
  pendingTabIds?: ReadonlySet<number>
  copiedTabIds?: ReadonlySet<number>
}

export function DomainGroup({
  group,
  pinned = false,
  collapsed,
  duplicateCount = 0,
  onToggleCollapse,
  onToggleGroupPin,
  onRemoveDuplicates,
  onToggleGroupMask,
  onCloseGroup,
  onActivate,
  onTogglePin,
  onToggleFavorite,
  onToggleMask,
  onCopy,
  onClose,
  t,
  pinnedTabIds,
  favoriteTabIds,
  pendingTabIds,
  copiedTabIds,
}: DomainGroupProps) {
  const reactId = useId()
  const headingId = `domain-heading-${reactId}`
  const listId = `domain-tabs-${reactId}`
  const groupPending = group.tabs.some((tab) => pendingTabIds?.has(tab.id))
  const pinLabel = pinned ? t('unpinGroup') : t('pinGroup')
  const duplicateLabel = duplicateCount > 0
    ? t('removeDuplicateTabs', { count: duplicateCount })
    : t('noDuplicateTabs')
  const maskLabel = group.allMasked ? t('showGroupInformation') : t('hideGroupInformation')
  const closeLabel = t('closeDomainGroup', { label: group.label, count: group.tabs.length })

  return <section className={`window-group domain-group${pinned ? ' is-pinned' : ''}`} aria-labelledby={headingId}>
    <h2 id={headingId} className="domain-group-heading">
      <button type="button" className="window-toggle domain-toggle" aria-expanded={!collapsed} aria-controls={listId} onClick={() => onToggleCollapse(group.key)}><Icon name="chevron" /><span>{group.label}</span><span>{t('tabCount', { count: group.tabs.length })}</span></button>
      <span className="domain-group-actions">
        <button type="button" className={`icon-button domain-group-action row-action-button row-pin-action${pinned ? ' is-pinned' : ''}`} aria-label={pinLabel} title={pinLabel} aria-pressed={pinned} onClick={(event) => { event.stopPropagation(); onToggleGroupPin?.(group) }}><Icon name="pin" width={15} height={15} /></button>
        <button type="button" className="icon-button domain-group-action row-action-button row-deduplicate-action" aria-label={duplicateLabel} title={duplicateLabel} disabled={!onRemoveDuplicates || duplicateCount === 0 || groupPending} onClick={(event) => { event.stopPropagation(); onRemoveDuplicates?.(group) }}><Icon name="deduplicate" width={15} height={15} /></button>
        <button type="button" className="icon-button domain-group-action row-action-button row-privacy-action" aria-label={maskLabel} title={maskLabel} onClick={(event) => { event.stopPropagation(); onToggleGroupMask(group) }}><Icon name={group.allMasked ? 'eye' : 'eye-off'} width={15} height={15} /></button>
        <button type="button" className="icon-button domain-group-action close-button row-action-button row-close-action" aria-label={closeLabel} title={closeLabel} onClick={(event) => { event.stopPropagation(); onCloseGroup(group) }} disabled={groupPending}><Icon name="close" width={15} height={15} /></button>
      </span>
    </h2>
    <ul className="tab-list" id={listId} hidden={collapsed}>{!collapsed ? group.tabs.map((tab) => <TabRow key={tab.id} tab={tab} pinned={pinnedTabIds?.has(tab.id)} favorite={favoriteTabIds?.has(tab.id)} onActivate={onActivate} onTogglePin={onTogglePin} onToggleFavorite={onToggleFavorite} onToggleMask={onToggleMask} onCopy={onCopy} onClose={onClose} t={t} pending={pendingTabIds?.has(tab.id)} copied={copiedTabIds?.has(tab.id)} />) : null}</ul>
  </section>
}
