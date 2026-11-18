import type { PlainTranslationKey, Translator } from '../i18n/i18n'
import type { UiColorScheme } from '../types'
import { Icon, type IconName } from './Icon'

interface ColorSchemeToggleProps {
  value: UiColorScheme
  onChange: (colorScheme: UiColorScheme) => void
  t: Translator
}

const nextScheme: Record<UiColorScheme, UiColorScheme> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
}

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

/** One icon button: each click moves auto → light → dark → auto. */
export function ColorSchemeToggle({ value, onChange, t }: ColorSchemeToggleProps) {
  const label = `${t('colorScheme')}: ${t(labels[value])}`

  return (
    <button
      type="button"
      className="compact-icon-button color-scheme-toggle"
      aria-label={label}
      title={label}
      data-color-scheme={value}
      onClick={() => onChange(nextScheme[value])}
    >
      <Icon name={icons[value]} width={16} height={16} />
    </button>
  )
}
