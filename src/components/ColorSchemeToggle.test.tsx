import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { createTranslator } from '../i18n/i18n'
import type { UiColorScheme } from '../types'
import { ColorSchemeToggle } from './ColorSchemeToggle'

const t = createTranslator('en')

function Harness() {
  const [value, setValue] = useState<UiColorScheme>('auto')
  return <ColorSchemeToggle value={value} onChange={setValue} t={t} />
}

it('cycles auto, light and dark with one click each and opens no menu', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  const button = screen.getByRole('button')
  expect(button).toHaveAccessibleName('Appearance: Auto (system)')
  expect(button).not.toHaveAttribute('aria-haspopup')

  await user.click(button)
  expect(button).toHaveAccessibleName('Appearance: Light')
  expect(button).toHaveAttribute('data-color-scheme', 'light')
  await user.click(button)
  expect(button).toHaveAccessibleName('Appearance: Dark')
  await user.click(button)
  expect(button).toHaveAccessibleName('Appearance: Auto (system)')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
