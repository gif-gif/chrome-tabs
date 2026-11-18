import { useState, type FormEvent } from 'react'
import { MAX_CUSTOM_GROUP_NAME_LENGTH } from '../domain/customGroups'
import type { Translator } from '../i18n/i18n'
import { Icon } from './Icon'

interface CustomGroupCreatorProps {
  onCreate: (name: string) => void
  t: Translator
  /** Shows the name field right away, e.g. when there are no groups yet. */
  defaultOpen?: boolean
}

/**
 * A compact "new group" action that expands into a name field on demand,
 * so it takes one slim row instead of a full input above the groups.
 */
export function CustomGroupCreator({ onCreate, t, defaultOpen = false }: CustomGroupCreatorProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [name, setName] = useState('')
  const canCreate = name.trim().length > 0

  function close() {
    setName('')
    setOpen(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) return
    onCreate(name)
    setName('')
  }

  if (!open) {
    return <div className="custom-group-creator">
      <button type="button" className="custom-group-creator-trigger" onClick={() => setOpen(true)}>
        <Icon name="plus" width={14} height={14} />
        <span>{t('createCustomGroup')}</span>
      </button>
    </div>
  }

  return <form
    className="custom-group-creator is-open"
    onSubmit={handleSubmit}
    onBlur={(event) => {
      if (!canCreate && !event.currentTarget.contains(event.relatedTarget)) close()
    }}
  >
    <input
      aria-label={t('newCustomGroupName')}
      placeholder={t('newCustomGroupPlaceholder')}
      value={name}
      maxLength={MAX_CUSTOM_GROUP_NAME_LENGTH}
      autoFocus={!defaultOpen}
      onChange={(event) => setName(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }}
    />
    <button type="submit" className="icon-button row-action-button custom-group-create-button" aria-label={t('createCustomGroup')} title={t('createCustomGroup')} disabled={!canCreate}>
      <Icon name="check" width={15} height={15} />
    </button>
    <button type="button" className="icon-button row-action-button" aria-label={t('cancel')} title={t('cancel')} onClick={close}>
      <Icon name="close" width={15} height={15} />
    </button>
  </form>
}
