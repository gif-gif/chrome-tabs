import { useId, useState, type FormEvent } from 'react'
import { MAX_CUSTOM_GROUP_NAME_LENGTH } from '../domain/customGroups'
import { resolveSafeFaviconUrl } from '../domain/tabs'
import type { Translator } from '../i18n/i18n'
import type { BrowserTab, DisplayCustomGroup, DisplayTab } from '../types'
import { Icon } from './Icon'
import { TabRow } from './TabRow'

export interface CustomGroupPickerOption {
  url: string
  /** Undefined when the saved URL has no open tab. */
  tab?: BrowserTab
  masked: boolean
}

interface CustomGroupProps {
  group: DisplayCustomGroup
  /** False for the built-in "ungrouped" section, which cannot be edited. */
  editable: boolean
  collapsed: boolean
  pickerOptions?: readonly CustomGroupPickerOption[]
  selectedUrls?: ReadonlySet<string>
  onToggleCollapse: (groupKey: string) => void
  onToggleUrl?: (groupKey: string, url: string) => void
  onRename?: (groupKey: string, name: string) => void
  onDelete?: (group: DisplayCustomGroup) => void
  onToggleGroupMask: (group: DisplayCustomGroup) => void
  onCloseGroup: (group: DisplayCustomGroup) => void
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

export function CustomGroup({
  group,
  editable,
  collapsed,
  pickerOptions = [],
  selectedUrls = new Set(),
  onToggleCollapse,
  onToggleUrl,
  onRename,
  onDelete,
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
}: CustomGroupProps) {
  const reactId = useId()
  const headingId = `custom-heading-${reactId}`
  const listId = `custom-tabs-${reactId}`
  const pickerId = `custom-picker-${reactId}`
  const [picking, setPicking] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(group.label)
  const groupPending = group.tabs.some((tab) => pendingTabIds?.has(tab.id))
  const maskLabel = group.allMasked ? t('showGroupInformation') : t('hideGroupInformation')
  const closeLabel = t('closeDomainGroup', { label: group.label, count: group.tabs.length })
  const pickLabel = t('chooseGroupTabs', { label: group.label })
  const renameLabel = t('renameCustomGroup', { label: group.label })
  const deleteLabel = t('deleteCustomGroup', { label: group.label })

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onRename?.(group.key, draftName)
    setRenaming(false)
  }

  return <section className="window-group domain-group custom-group" aria-labelledby={headingId}>
    <h2 id={headingId} className="domain-group-heading">
      {renaming ? (
        <form className="custom-group-name-form" onSubmit={handleRenameSubmit}>
          <input
            aria-label={t('customGroupName')}
            value={draftName}
            maxLength={MAX_CUSTOM_GROUP_NAME_LENGTH}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setRenaming(false)
              }
            }}
          />
          <button type="submit" className="icon-button domain-group-action row-action-button" aria-label={t('saveCustomGroupName')} title={t('saveCustomGroupName')}><Icon name="check" width={15} height={15} /></button>
          <button type="button" className="icon-button domain-group-action row-action-button" aria-label={t('cancel')} title={t('cancel')} onClick={() => setRenaming(false)}><Icon name="close" width={15} height={15} /></button>
        </form>
      ) : (
        <button type="button" className="window-toggle domain-toggle" aria-expanded={!collapsed} aria-controls={listId} onClick={() => onToggleCollapse(group.key)}><Icon name="chevron" /><span>{group.label}</span><span>{t('tabCount', { count: group.tabs.length })}</span></button>
      )}
      <span className="domain-group-actions">
        {editable && !renaming ? <>
          <button type="button" className={`icon-button domain-group-action row-action-button row-pick-action${picking ? ' is-active' : ''}`} aria-label={pickLabel} title={pickLabel} aria-expanded={picking} aria-controls={pickerId} onClick={() => setPicking((current) => !current)}><Icon name="checklist" width={15} height={15} /></button>
          <button type="button" className="icon-button domain-group-action row-action-button" aria-label={renameLabel} title={renameLabel} onClick={() => { setDraftName(group.label); setRenaming(true) }}><Icon name="edit" width={15} height={15} /></button>
        </> : null}
        <button type="button" className="icon-button domain-group-action row-action-button row-privacy-action" aria-label={maskLabel} title={maskLabel} disabled={group.tabs.length === 0} onClick={() => onToggleGroupMask(group)}><Icon name={group.allMasked ? 'eye' : 'eye-off'} width={15} height={15} /></button>
        <button type="button" className="icon-button domain-group-action close-button row-action-button row-close-action" aria-label={closeLabel} title={closeLabel} onClick={() => onCloseGroup(group)} disabled={groupPending || group.tabs.length === 0}><Icon name="close" width={15} height={15} /></button>
        {editable ? <button type="button" className="icon-button domain-group-action close-button row-action-button row-close-action" aria-label={deleteLabel} title={deleteLabel} onClick={() => onDelete?.(group)}><Icon name="trash" width={15} height={15} /></button> : null}
      </span>
    </h2>
    {picking ? (
      <fieldset className="custom-group-picker" id={pickerId}>
        <legend>{t('chooseGroupTabsHint')}</legend>
        {pickerOptions.length === 0 ? <p className="custom-group-picker-empty">{t('noTabsToChoose')}</p> : null}
        <ul>
          {pickerOptions.map((option) => {
            const faviconUrl = option.tab && !option.masked
              ? resolveSafeFaviconUrl(option.tab.favIconUrl, option.tab.url)
              : undefined
            const title = option.masked
              ? t('informationHidden')
              : option.tab?.title || option.url
            return <li key={option.url}>
              <label className="custom-group-picker-option">
                <input type="checkbox" checked={selectedUrls.has(option.url)} onChange={() => onToggleUrl?.(group.key, option.url)} />
                {faviconUrl ? <img src={faviconUrl} alt="" /> : <Icon name="tab" width={16} height={16} />}
                <span className="tab-copy">
                  <span className="tab-title">{title}</span>
                  {!option.masked ? <span className="tab-url">{option.url}</span> : null}
                  {!option.tab ? <span className="current-label">{t('savedTabNotOpen')}</span> : null}
                </span>
              </label>
            </li>
          })}
        </ul>
      </fieldset>
    ) : null}
    <ul className="tab-list" id={listId} hidden={collapsed}>
      {!collapsed && editable && group.tabs.length === 0 && !picking
        ? <li className="custom-group-empty">{group.savedUrlCount === 0 ? t('customGroupEmpty') : t('customGroupNoOpenTabs')}</li>
        : null}
      {!collapsed ? group.tabs.map((tab) => <TabRow key={tab.id} tab={tab} pinned={pinnedTabIds?.has(tab.id)} favorite={favoriteTabIds?.has(tab.id)} onActivate={onActivate} onTogglePin={onTogglePin} onToggleFavorite={onToggleFavorite} onToggleMask={onToggleMask} onCopy={onCopy} onClose={onClose} t={t} pending={pendingTabIds?.has(tab.id)} copied={copiedTabIds?.has(tab.id)} />) : null}
    </ul>
  </section>
}
