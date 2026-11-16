import { useState, type FormEvent } from 'react'
import { MAX_CUSTOM_GROUP_NAME_LENGTH } from '../domain/customGroups'
import type { Translator } from '../i18n/i18n'
import { Icon } from './Icon'

interface CustomGroupCreatorProps {
  onCreate: (name: string) => void
  t: Translator
}

export function CustomGroupCreator({ onCreate, t }: CustomGroupCreatorProps) {
  const [name, setName] = useState('')
  const canCreate = name.trim().length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) return
    onCreate(name)
    setName('')
  }

  return <form className="custom-group-creator" onSubmit={handleSubmit}>
    <input
      aria-label={t('newCustomGroupName')}
      placeholder={t('newCustomGroupPlaceholder')}
      value={name}
      maxLength={MAX_CUSTOM_GROUP_NAME_LENGTH}
      onChange={(event) => setName(event.target.value)}
    />
    <button type="submit" className="compact-icon-button custom-group-create-button" aria-label={t('createCustomGroup')} title={t('createCustomGroup')} disabled={!canCreate}>
      <Icon name="plus" width={16} height={16} />
    </button>
  </form>
}
