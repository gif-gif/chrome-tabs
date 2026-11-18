import type { ReactNode } from 'react'
import type { Translator } from '../i18n/i18n'
import type { TabFilter, TabSortStep } from '../types'
import { Icon, type IconName } from './Icon'

type HeaderFilter = Exclude<TabFilter, 'current-window'>

interface HeaderProps {
  count: number
  filter: TabFilter
  globalMasked: boolean
  onFilterChange: (filter: TabFilter) => void
  onToggleMask: () => void
  onSortTabs?: () => void
  sortStep?: TabSortStep
  sortingTabs?: boolean
  t: Translator
  beforeMaskAction?: ReactNode
  afterMaskAction?: ReactNode
}

const filterIcons: Record<HeaderFilter, IconName> = {
  all: 'all-tabs',
  favorites: 'star',
}

const sortIcons: Record<TabSortStep, IconName> = {
  asc: 'sort-ascending',
  desc: 'sort-descending',
  restore: 'restore-order',
}

export function Header({
  count,
  filter,
  globalMasked,
  onFilterChange,
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
  const countLabel = t('tabCount', { count })
  const filters: Array<{
    value: HeaderFilter
    label: string
    accessibleLabel: string
  }> = [
    { value: 'all', label: t('allShort'), accessibleLabel: t('allTabs') },
    {
      value: 'favorites',
      label: t('favoritesShort'),
      accessibleLabel: t('favoriteTabs'),
    },
  ]

  return (
    <header className="app-header">
      <p className="tab-count" title={countLabel} aria-label={countLabel}>
        {count}
      </p>
      <div className="compact-filter-group" role="group" aria-label={t('tabFilters')}>
        {filters.map((option) => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={`compact-filter-button${selected ? ' is-active' : ''}`}
              aria-label={option.accessibleLabel}
              aria-pressed={selected}
              title={option.accessibleLabel}
              onClick={() => onFilterChange(option.value)}
            >
              <Icon name={filterIcons[option.value]} width={16} height={16} />
              <span className="compact-filter-label">{option.label}</span>
            </button>
          )
        })}
      </div>
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
