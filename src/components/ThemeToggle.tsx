import type { Translator } from '../i18n/i18n'
import type { UiTheme } from '../types'
import { Icon } from './Icon'

interface ThemeToggleProps {
  theme: UiTheme
  onChange: (theme: UiTheme) => void
  t: Translator
}

const themeCycle: Record<UiTheme, UiTheme> = {
  classic: 'aurora',
  aurora: 'sunset',
  sunset: 'twilight',
  twilight: 'classic',
}

const themeLabels = {
  classic: 'switchToClassicTheme',
  aurora: 'switchToAuroraTheme',
  sunset: 'switchToSunsetTheme',
  twilight: 'switchToTwilightTheme',
} as const

export function ThemeToggle({ theme, onChange, t }: ThemeToggleProps) {
  const nextTheme = themeCycle[theme]
  const label = t(themeLabels[nextTheme])

  return (
    <button
      type="button"
      className="compact-icon-button theme-toggle"
      aria-label={label}
      title={label}
      aria-pressed={theme !== 'classic'}
      data-theme={theme}
      onClick={() => onChange(nextTheme)}
    >
      <Icon name="palette" width={16} height={16} />
    </button>
  )
}
