import type { ChangeEvent, KeyboardEvent } from 'react'
import type { Translator } from '../i18n/i18n'
import type { UiViewMode } from '../types'
import { Icon } from './Icon'

interface SearchFiltersProps {
  query: string
  viewMode: UiViewMode
  onQueryChange: (query: string) => void
  onViewModeChange: (viewMode: UiViewMode) => void
  t: Translator
}

export function SearchFilters({ query, viewMode, onQueryChange, onViewModeChange, t }: SearchFiltersProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onQueryChange(event.currentTarget.value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && query) {
      event.preventDefault()
      onQueryChange('')
    }
  }

  return (
    <section className="search-row" role="search" aria-label={t('searchAndView')}>
      <div className="search-box">
        <Icon name="search" />
        <input type="search" aria-label={t('searchTabs')} placeholder={t('searchPlaceholder')} value={query} onChange={handleChange} onKeyDown={handleKeyDown} />
        {query ? <button type="button" className="icon-button search-clear" aria-label={t('clearSearch')} onClick={() => onQueryChange('')}><Icon name="clear" /></button> : null}
      </div>
      <div role="group" aria-label={t('viewMode')} className="view-mode-switch">
        <button type="button" className="compact-icon-button" aria-label={t('listView')} title={t('listView')} aria-pressed={viewMode === 'list'} onClick={() => onViewModeChange('list')}>
          <Icon name="list" width={16} height={16} />
        </button>
        <button type="button" className="compact-icon-button" aria-label={t('domainView')} title={t('domainView')} aria-pressed={viewMode === 'domain'} onClick={() => onViewModeChange('domain')}>
          <Icon name="group" width={16} height={16} />
        </button>
      </div>
    </section>
  )
}
