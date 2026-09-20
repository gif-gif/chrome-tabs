import { useId } from 'react'
import type { Translator } from '../i18n/i18n'
import type { DisplayTab, DisplayWindow } from '../types'
import { Icon } from './Icon'
import { TabRow } from './TabRow'

interface WindowGroupProps {
  window: DisplayWindow
  collapsed: boolean
  onToggleCollapse: (windowId: number) => void
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

export function WindowGroup({ window, collapsed, onToggleCollapse, onActivate, onTogglePin, onToggleFavorite, onToggleMask, onCopy, onClose, t, pinnedTabIds, favoriteTabIds, pendingTabIds, copiedTabIds }: WindowGroupProps) {
  const headingId = `window-${window.id}-heading`
  const listId = `window-${window.id}-tabs-${useId()}`

  return <section className="window-group window-list-group" aria-labelledby={headingId}>
    <h2 id={headingId}><button type="button" className="window-toggle" aria-expanded={!collapsed} aria-controls={listId} onClick={() => onToggleCollapse(window.id)}><Icon name="chevron" /><span>{window.label}</span><span>{t('tabCount', { count: window.tabs.length })}</span></button></h2>
    <ul className="tab-list" id={listId} hidden={collapsed}>{!collapsed ? window.tabs.map((tab) => <TabRow key={tab.id} tab={tab} pinned={pinnedTabIds?.has(tab.id)} favorite={favoriteTabIds?.has(tab.id)} onActivate={onActivate} onTogglePin={onTogglePin} onToggleFavorite={onToggleFavorite} onToggleMask={onToggleMask} onCopy={onCopy} onClose={onClose} t={t} pending={pendingTabIds?.has(tab.id)} copied={copiedTabIds?.has(tab.id)} />) : null}</ul>
  </section>
}
