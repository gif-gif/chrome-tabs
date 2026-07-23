import { useEffect, useRef } from 'react'
import type { Translator, UiLanguagePreference } from '../i18n/i18n'
import { Icon } from './Icon'

export type LanguageMenuChangeReason = 'trigger' | 'selection' | 'escape' | 'outside-pointer'

interface LanguageMenuProps {
  open: boolean
  value: UiLanguagePreference
  onOpenChange: (open: boolean, reason: LanguageMenuChangeReason) => void
  onChange: (language: UiLanguagePreference) => void
  t: Translator
}

const values: UiLanguagePreference[] = ['auto', 'zh-CN', 'en']

export function LanguageMenu({ open, value, onOpenChange, onChange, t }: LanguageMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef(new Map<UiLanguagePreference, HTMLButtonElement>())
  const onOpenChangeRef = useRef(onOpenChange)

  const labels: Record<UiLanguagePreference, string> = {
    auto: t('autoLanguage'),
    'zh-CN': t('chineseLanguage'),
    en: t('englishLanguage'),
  }

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  useEffect(() => {
    if (!open) return
    const selected = itemRefs.current.get(value) ?? itemRefs.current.get('auto')
    selected?.focus()
  }, [open, value])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        onOpenChangeRef.current(false, 'outside-pointer')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function closeAndRestoreFocus(reason: 'selection' | 'escape') {
    onOpenChange(false, reason)
    triggerRef.current?.focus()
  }

  function focusAt(index: number) {
    itemRefs.current.get(values[(index + values.length) % values.length])?.focus()
  }

  function selectValue(language: UiLanguagePreference) {
    onChange(language)
    closeAndRestoreFocus('selection')
  }

  return (
    <div className="language-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="compact-icon-button language-menu-trigger"
        aria-label={t('displayLanguage')}
        title={t('displayLanguage')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open, 'trigger')}
      >
        <Icon name="globe" width={16} height={16} />
      </button>
      {open ? (
        <div className="language-menu" role="menu" aria-label={t('displayLanguage')} onKeyDown={(event) => {
          const activeIndex = values.findIndex((candidate) => itemRefs.current.get(candidate) === document.activeElement)
          if (event.key === 'Escape') {
            event.preventDefault()
            closeAndRestoreFocus('escape')
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            focusAt(activeIndex + 1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            focusAt(activeIndex - 1)
          } else if (event.key === 'Home') {
            event.preventDefault()
            focusAt(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            focusAt(values.length - 1)
          } else if ((event.key === 'Enter' || event.key === ' ') && activeIndex >= 0) {
            event.preventDefault()
            selectValue(values[activeIndex])
          }
        }}>
          {values.map((candidate) => (
            <button
              key={candidate}
              ref={(node) => {
                if (node) itemRefs.current.set(candidate, node)
                else itemRefs.current.delete(candidate)
              }}
              type="button"
              role="menuitemradio"
              aria-checked={candidate === value}
              className="language-menu-item"
              onClick={() => selectValue(candidate)}
            >
              <span>{labels[candidate]}</span>
              {candidate === value ? <Icon name="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
