import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { createTranslator } from '../i18n/i18n'
import type { UiColorScheme } from '../types'
import { ColorSchemeMenu } from './ColorSchemeMenu'

const t = createTranslator('en')

function Harness({ onChange }: { onChange: (value: UiColorScheme) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<UiColorScheme>('auto')
  return <ColorSchemeMenu
    open={open}
    value={value}
    onOpenChange={setOpen}
    onChange={(next) => { setValue(next); onChange(next) }}
    t={t}
  />
}

it('selects a scheme with one click and shows its icon on the trigger', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness onChange={onChange} />)

  const trigger = screen.getByRole('button', { name: 'Appearance: Auto (system)' })
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  await user.click(trigger)
  expect(screen.getByRole('menuitemradio', { name: 'Auto (system)' })).toHaveFocus()

  await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
  expect(onChange).toHaveBeenCalledWith('dark')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Appearance: Dark' })).toHaveAttribute('data-color-scheme', 'dark')
})

it('supports arrow keys and closes on Escape without changing the scheme', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Appearance: Auto (system)' }))
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveFocus()
  await user.keyboard('{End}')
  expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Appearance: Auto (system)' })).toHaveFocus()
  expect(onChange).not.toHaveBeenCalled()
})
