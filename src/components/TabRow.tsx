import type { MouseEvent } from 'react'
import { isSafeFaviconUrl } from '../domain/tabs'
import type { Translator } from '../i18n/i18n'
import type { DisplayTab } from '../types'
import { Icon } from './Icon'

interface TabRowProps {
  tab: DisplayTab
  onActivate: (tab: DisplayTab) => void
  onTogglePin?: (tab: DisplayTab) => void
  onToggleFavorite?: (tab: DisplayTab) => void
  onToggleMask: (tab: DisplayTab) => void
  onCopy: (tab: DisplayTab) => void
  onClose: (tab: DisplayTab) => void
  t: Translator
  pinned?: boolean
  favorite?: boolean
  pending?: boolean
  copied?: boolean
}

export function TabRow({
  tab,
  onActivate,
  onTogglePin,
  onToggleFavorite,
  onToggleMask,
  onCopy,
  onClose,
  t,
  pinned = false,
  favorite = false,
  pending = false,
  copied = false,
}: TabRowProps) {
  const rowClassName = `${tab.active ? 'tab-row is-active' : 'tab-row'}${pinned ? ' is-pinned' : ''}${favorite ? ' is-favorite' : ''}`
  const currentSuffix = tab.active ? t('currentTabSuffix') : ''
  const activationLabel = tab.masked
    ? t('activateMaskedTab', { current: currentSuffix })
    : `${tab.displayTitle}${currentSuffix}`
  const privacyLabel = tab.masked ? t('showTabInformation') : t('hideTabInformation')
  const pinLabel = pinned ? t('unpinTab') : t('pinTab')
  const favoriteLabel = favorite ? t('removeTabFromFavorites') : t('addTabToFavorites')
  const faviconUrl = !tab.masked && isSafeFaviconUrl(tab.displayFavIconUrl)
    ? tab.displayFavIconUrl
    : undefined

  function isolateAction(
    event: MouseEvent<HTMLButtonElement>,
    action: ((tab: DisplayTab) => void) | undefined,
  ) {
    event.stopPropagation()
    action?.(tab)
  }

  return <li className={rowClassName} aria-busy={pending || undefined}>
    <button type="button" className="tab-main" aria-label={activationLabel} aria-current={tab.active ? 'page' : undefined} disabled={pending} onClick={() => onActivate(tab)}>
      {faviconUrl ? <img src={faviconUrl} alt="" /> : <Icon name="tab" />}
      <span className="tab-copy"><span className="tab-title">{tab.displayTitle}</span>{!tab.masked && tab.displayUrl ? <span className="tab-url">{tab.displayUrl}</span> : null}{tab.active ? <span className="current-label">{t('currentTab')}</span> : null}</span>
    </button>
    <button type="button" className={`icon-button tab-action row-action-button row-pin-action${pinned ? ' is-pinned' : ''}`} aria-label={pinLabel} title={pinLabel} aria-pressed={pinned} onClick={(event) => isolateAction(event, onTogglePin)}><Icon name="pin" width={15} height={15} /></button>
    <button type="button" className={`icon-button tab-action row-action-button row-favorite-action${favorite ? ' is-favorite' : ''}`} aria-label={favoriteLabel} title={favoriteLabel} aria-pressed={favorite} disabled={pending || !onToggleFavorite} onClick={(event) => isolateAction(event, onToggleFavorite)}><Icon name="star" width={15} height={15} /></button>
    <button type="button" className="icon-button tab-action row-action-button row-privacy-action" aria-label={privacyLabel} onClick={(event) => isolateAction(event, onToggleMask)}><Icon name={tab.masked ? 'eye' : 'eye-off'} width={15} height={15} /></button>
    <button type="button" className={`icon-button tab-action row-action-button row-copy-action${copied ? ' is-copied' : ''}`} aria-label={t('copyTabLink')} data-copied={copied || undefined} disabled={pending} onClick={(event) => isolateAction(event, onCopy)}><Icon name={copied ? 'check' : 'copy'} width={15} height={15} /></button>
    <button type="button" className="icon-button tab-action close-button row-action-button row-close-action" aria-label={t('closeTab')} disabled={pending} onClick={(event) => isolateAction(event, onClose)}><Icon name="close" width={15} height={15} /></button>
  </li>
}
