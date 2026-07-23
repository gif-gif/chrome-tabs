import { useId } from 'react'
import type { Translator } from '../i18n/i18n'
import type { DisplayDomainGroup, DisplayTab } from '../types'
import { Icon } from './Icon'
import { TabRow } from './TabRow'
interface DomainGroupProps { group: DisplayDomainGroup; collapsed: boolean; onToggleCollapse: (groupKey: string) => void; onToggleGroupMask: (group: DisplayDomainGroup) => void; onCloseGroup: (group: DisplayDomainGroup) => void; onActivate: (tab: DisplayTab) => void; onToggleMask: (tab: DisplayTab) => void; onClose: (tab: DisplayTab) => void; t: Translator; pendingTabIds?: ReadonlySet<number> }
export function DomainGroup({ group, collapsed, onToggleCollapse, onToggleGroupMask, onCloseGroup, onActivate, onToggleMask, onClose, t, pendingTabIds }: DomainGroupProps) {
  const reactId = useId(); const headingId = `domain-heading-${reactId}`; const listId = `domain-tabs-${reactId}`
  const groupPending = group.tabs.some((tab) => pendingTabIds?.has(tab.id))
  const maskLabel = group.allMasked ? t('showGroupInformation') : t('hideGroupInformation')
  const closeLabel = t('closeDomainGroup', { label: group.label, count: group.tabs.length })
  return <section className="window-group domain-group" aria-labelledby={headingId}><h2 id={headingId} className="domain-group-heading"><button type="button" className="window-toggle domain-toggle" aria-expanded={!collapsed} aria-controls={listId} onClick={() => onToggleCollapse(group.key)}><Icon name="chevron" /><span>{group.label}</span><span>{t('tabCount', { count: group.tabs.length })}</span></button><span className="domain-group-actions"><button type="button" className="icon-button domain-group-action row-action-button row-privacy-action" aria-label={maskLabel} onClick={(event) => { event.stopPropagation(); onToggleGroupMask(group) }}><Icon name={group.allMasked ? 'eye' : 'eye-off'} width={15} height={15} /></button><button type="button" className="icon-button domain-group-action close-button row-action-button row-close-action" aria-label={closeLabel} onClick={(event) => { event.stopPropagation(); onCloseGroup(group) }} disabled={groupPending}><Icon name="close" width={15} height={15} /></button></span></h2><ul className="tab-list" id={listId} hidden={collapsed}>{!collapsed ? group.tabs.map((tab) => <TabRow key={tab.id} tab={tab} onActivate={onActivate} onToggleMask={onToggleMask} onClose={onClose} t={t} pending={pendingTabIds?.has(tab.id)} />) : null}</ul></section>
}
