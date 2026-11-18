import { useEffect, useRef } from 'react'
import type { PlainTranslationKey, Translator } from '../i18n/i18n'
import type { UiColorScheme } from '../types'
import { Icon, type IconName } from './Icon'
import type { LanguageMenuChangeReason } from './LanguageMenu'

interface ColorSchemeMenuProps {
  open: boolean
  value: UiColorScheme
  onOpenChange: (open: boolean, reason: LanguageMenuChangeReason) => void
  onChange: (colorScheme: UiColorScheme) => void
  t: Translator
}

const values: UiColorScheme[] = ['auto', 'light', 'dark']

const labels: Record<UiColorScheme, PlainTranslationKey> = {
  auto: 'colorSchemeAuto',
  light: 'colorSchemeLight',
  dark: 'colorSchemeDark',
}

const icons: Record<UiColorScheme, IconName> = {
  auto: 'contrast',
  light: 'sun',
  dark: 'moon',
}

/** Appearance picker: auto follows the system, light and dark apply at once. */
export function ColorSchemeMenu({ open, value, onOpenChange, onChange, t }: ColorSchemeMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef(new Map<UiColorScheme, HTMLButtonElement>())
  const onOpenChangeRef = useRef(onOpenChange)

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  useEffect(() => {
    if (!open) return
    itemRefs.current.get(value)?.focus()
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

  function selectValue(colorScheme: UiColorScheme) {
    onChange(colorScheme)
    closeAndRestoreFocus('selection')
  }

  const triggerLabel = `${t('colorScheme')}: ${t(labels[value])}`

  return (
    <div className="language-menu-root color-scheme-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="compact-icon-button language-menu-trigger color-scheme-trigger"
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        data-color-scheme={value}
        onClick={() => onOpenChange(!open, 'trigger')}
      >
        <Icon name={icons[value]} width={16} height={16} />
      </button>
      {open ? (
        <div className="language-menu" role="menu" aria-label={t('colorScheme')} onKeyDown={(event) => {
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
              className="language-menu-item color-scheme-menu-item"
              onClick={() => selectValue(candidate)}
            >
              <span className="color-scheme-menu-label"><Icon name={icons[candidate]} width={16} height={16} />{t(labels[candidate])}</span>
              {candidate === value ? <Icon name="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
