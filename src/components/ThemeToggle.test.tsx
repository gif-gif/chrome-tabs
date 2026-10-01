import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { Translator } from '../i18n/i18n'
import { ThemeToggle } from './ThemeToggle'

const labels = {
  switchToAuroraTheme: 'Switch to Aurora theme',
  switchToSunsetTheme: 'Switch to Sunset theme',
  switchToTwilightTheme: 'Switch to Twilight theme',
  switchToOceanTheme: 'Switch to Ocean theme',
  switchToForestTheme: 'Switch to Forest theme',
  switchToSakuraTheme: 'Switch to Sakura theme',
  switchToGraphiteTheme: 'Switch to Graphite theme',
  switchToLemonTheme: 'Switch to Lemon theme',
  switchToCoffeeTheme: 'Switch to Coffee theme',
  switchToMidnightTheme: 'Switch to Midnight theme',
  switchToLavenderTheme: 'Switch to Lavender theme',
  switchToMintTheme: 'Switch to Mint theme',
  switchToCoralTheme: 'Switch to Coral theme',
  switchToSkyTheme: 'Switch to Sky theme',
  switchToAmberTheme: 'Switch to Amber theme',
  switchToTealTheme: 'Switch to Teal theme',
  switchToRubyTheme: 'Switch to Ruby theme',
  switchToPlumTheme: 'Switch to Plum theme',
  switchToSandTheme: 'Switch to Sand theme',
  switchToIceTheme: 'Switch to Ice theme',
  switchToMossTheme: 'Switch to Moss theme',
  switchToPeachTheme: 'Switch to Peach theme',
  switchToCobaltTheme: 'Switch to Cobalt theme',
  switchToOrchidTheme: 'Switch to Orchid theme',
  switchToCrimsonTheme: 'Switch to Crimson theme',
  switchToClassicTheme: 'Switch to Classic theme',
}

const t = ((key: keyof typeof labels) => labels[key]) as Translator

it('offers Aurora from the classic theme and switches on click', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()

  render(<ThemeToggle theme="classic" onChange={onChange} t={t} />)

  const button = screen.getByRole('button', { name: 'Switch to Aurora theme' })
  expect(button).toHaveAttribute('title', 'Switch to Aurora theme')
  expect(button).toHaveAttribute('aria-pressed', 'false')
  expect(button).toHaveClass('compact-icon-button', 'theme-toggle')
  expect(button.querySelector('svg')).toBeInTheDocument()

  await user.click(button)

  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith('aurora')
})

it.each([
  ['aurora', 'Switch to Sunset theme', 'sunset'],
  ['sunset', 'Switch to Twilight theme', 'twilight'],
  ['twilight', 'Switch to Ocean theme', 'ocean'],
  ['ocean', 'Switch to Forest theme', 'forest'],
  ['forest', 'Switch to Sakura theme', 'sakura'],
  ['sakura', 'Switch to Graphite theme', 'graphite'],
  ['graphite', 'Switch to Lemon theme', 'lemon'],
  ['lemon', 'Switch to Coffee theme', 'coffee'],
  ['coffee', 'Switch to Midnight theme', 'midnight'],
  ['midnight', 'Switch to Lavender theme', 'lavender'],
  ['lavender', 'Switch to Mint theme', 'mint'],
  ['mint', 'Switch to Coral theme', 'coral'],
  ['coral', 'Switch to Sky theme', 'sky'],
  ['sky', 'Switch to Amber theme', 'amber'],
  ['amber', 'Switch to Teal theme', 'teal'],
  ['teal', 'Switch to Ruby theme', 'ruby'],
  ['ruby', 'Switch to Plum theme', 'plum'],
  ['plum', 'Switch to Sand theme', 'sand'],
  ['sand', 'Switch to Ice theme', 'ice'],
  ['ice', 'Switch to Moss theme', 'moss'],
  ['moss', 'Switch to Peach theme', 'peach'],
  ['peach', 'Switch to Cobalt theme', 'cobalt'],
  ['cobalt', 'Switch to Orchid theme', 'orchid'],
  ['orchid', 'Switch to Crimson theme', 'crimson'],
  ['crimson', 'Switch to Classic theme', 'classic'],
] as const)('cycles from %s to the next theme', async (theme, label, nextTheme) => {
  const user = userEvent.setup()
  const onChange = vi.fn()

  render(<ThemeToggle theme={theme} onChange={onChange} t={t} />)

  const button = screen.getByRole('button', { name: label })
  expect(button).toHaveAttribute('title', label)
  expect(button).toHaveAttribute('aria-pressed', 'true')

  await user.click(button)

  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith(nextTheme)
})
