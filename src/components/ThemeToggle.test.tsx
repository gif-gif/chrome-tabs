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
  ['midnight', 'Switch to Classic theme', 'classic'],
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
