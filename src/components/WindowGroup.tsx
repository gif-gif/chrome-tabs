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
  onToggleMask: (tab: DisplayTab) => void
  onCopy: (tab: DisplayTab) => void
  onCopyMarkdown?: (tab: DisplayTab) => void
  onOpenInNewWindow?: (tab: DisplayTab) => void
  onClose: (tab: DisplayTab) => void
  soleWindowTabIds?: ReadonlySet<number>
  t: Translator
  pinnedTabIds?: ReadonlySet<number>
  pendingTabIds?: ReadonlySet<number>
  copiedTabIds?: ReadonlySet<number>
  markdownCopiedTabIds?: ReadonlySet<number>
}

export function WindowGroup({ window, collapsed, onToggleCollapse, onActivate, onTogglePin, onToggleMask, onCopy, onCopyMarkdown, onOpenInNewWindow, onClose, t, soleWindowTabIds, pinnedTabIds, pendingTabIds, copiedTabIds, markdownCopiedTabIds }: WindowGroupProps) {
  const headingId = `window-${window.id}-heading`
  const listId = `window-${window.id}-tabs-${useId()}`

  return <section className="window-group window-list-group" aria-labelledby={headingId}>
    <h2 id={headingId}><button type="button" className="window-toggle" aria-expanded={!collapsed} aria-controls={listId} onClick={() => onToggleCollapse(window.id)}><Icon name="chevron" /><span>{window.label}</span><span>{t('tabCount', { count: window.tabs.length })}</span></button></h2>
    <ul className="tab-list" id={listId} hidden={collapsed}>{!collapsed ? window.tabs.map((tab) => <TabRow key={tab.id} tab={tab} pinned={pinnedTabIds?.has(tab.id)} onActivate={onActivate} onTogglePin={onTogglePin} onToggleMask={onToggleMask} onCopy={onCopy} onCopyMarkdown={onCopyMarkdown} onOpenInNewWindow={onOpenInNewWindow} onClose={onClose} t={t} aloneInWindow={soleWindowTabIds?.has(tab.id)} pending={pendingTabIds?.has(tab.id)} copied={copiedTabIds?.has(tab.id)} markdownCopied={markdownCopiedTabIds?.has(tab.id)} />) : null}</ul>
  </section>
}
