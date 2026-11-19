import type { ReactNode } from 'react'
import type { Translator } from '../i18n/i18n'
import type { TabSortStep } from '../types'
import { Icon, type IconName } from './Icon'

interface HeaderProps {
  globalMasked: boolean
  onToggleMask: () => void
  onSortTabs?: () => void
  sortStep?: TabSortStep
  sortingTabs?: boolean
  t: Translator
  beforeMaskAction?: ReactNode
  afterMaskAction?: ReactNode
}

const sortIcons: Record<TabSortStep, IconName> = {
  asc: 'sort-ascending',
  desc: 'sort-descending',
  restore: 'restore-order',
}

export function Header({
  globalMasked,
  onToggleMask,
  onSortTabs,
  sortStep = 'asc',
  sortingTabs = false,
  t,
  beforeMaskAction,
  afterMaskAction,
}: HeaderProps) {
  const actionLabel = globalMasked ? t('showAllInformation') : t('hideAllInformation')
  const sortLabel = sortStep === 'asc'
    ? sortingTabs ? t('sortingTabsByDomainAscending') : t('sortTabsByDomainAscending')
    : sortStep === 'desc'
      ? sortingTabs ? t('sortingTabsByDomainDescending') : t('sortTabsByDomainDescending')
      : sortingTabs ? t('restoringOriginalTabOrder') : t('restoreOriginalTabOrder')

  return (
    <header className="app-header">
      <div className="app-header-actions">
        {onSortTabs ? (
          <button
            type="button"
            className="compact-icon-button sort-tabs-button"
            aria-label={sortLabel}
            title={sortLabel}
            disabled={sortingTabs}
            aria-busy={sortingTabs || undefined}
            onClick={onSortTabs}
          >
            <Icon
              name={sortIcons[sortStep]}
              width={16}
              height={16}
            />
          </button>
        ) : null}
        {beforeMaskAction}
        <button type="button" className="compact-icon-button global-mask-button" aria-label={actionLabel} title={actionLabel} onClick={onToggleMask}>
          <Icon name={globalMasked ? 'eye' : 'eye-off'} width={16} height={16} />
        </button>
        {afterMaskAction}
      </div>
    </header>
  )
}
