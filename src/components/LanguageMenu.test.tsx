import { StrictMode, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { createTranslator } from '../i18n/i18n'
import { LanguageMenu } from './LanguageMenu'

const t = createTranslator('en')

afterEach(() => {
  vi.restoreAllMocks()
})

it('keeps exactly one active outside-pointer listener in StrictMode and cleans it up', () => {
  const addListener = vi.spyOn(document, 'addEventListener')
  const removeListener = vi.spyOn(document, 'removeEventListener')

  const view = render(
    <StrictMode>
      <LanguageMenu
        open
        value="auto"
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        t={t}
      />
    </StrictMode>,
  )

  const addedPointerListeners = addListener.mock.calls
    .filter(([type]) => type === 'pointerdown')
    .map(([, listener]) => listener)
  const removedPointerListeners = removeListener.mock.calls
    .filter(([type]) => type === 'pointerdown')
    .map(([, listener]) => listener)

  expect(addedPointerListeners).toHaveLength(2)
  expect(removedPointerListeners).toEqual([addedPointerListeners[0]])

  view.rerender(
    <StrictMode>
      <LanguageMenu
        open={false}
        value="auto"
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        t={t}
      />
    </StrictMode>,
  )
  expect(
    removeListener.mock.calls
      .filter(([type]) => type === 'pointerdown')
      .map(([, listener]) => listener),
  ).toEqual(addedPointerListeners)

  view.unmount()
  expect(
    removeListener.mock.calls.filter(([type]) => type === 'pointerdown'),
  ).toHaveLength(2)
})

it('does not reset a moved menu focus when the parent callback identity changes', async () => {
  const user = userEvent.setup()
  const view = render(
    <LanguageMenu
      open
      value="auto"
      onOpenChange={vi.fn()}
      onChange={vi.fn()}
      t={t}
    />,
  )

  expect(screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  const chinese = screen.getByRole('menuitemradio', { name: '中文' })
  expect(chinese).toHaveFocus()

  view.rerender(
    <LanguageMenu
      open
      value="auto"
      onOpenChange={vi.fn()}
      onChange={vi.fn()}
      t={t}
    />,
  )

  expect(chinese).toHaveFocus()
})

it.each([
  { key: 'Enter', code: 'Enter' },
  { key: ' ', code: 'Space' },
])('selects exactly once with $code', ({ key, code }) => {
  const onChange = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <LanguageMenu
      open
      value="auto"
      onOpenChange={onOpenChange}
      onChange={onChange}
      t={t}
    />,
  )

  const automatic = screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })
  fireEvent.keyDown(automatic, { key, code })

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith('auto')
  expect(onOpenChange).toHaveBeenCalledTimes(1)
  expect(onOpenChange).toHaveBeenCalledWith(false, 'selection')
})

it('closes on an outside pointer without moving focus back to the trigger', () => {
  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <LanguageMenu
          open={open}
          value="auto"
          onOpenChange={(nextOpen) => setOpen(nextOpen)}
          onChange={vi.fn()}
          t={t}
        />
        <div data-testid="outside">Outside</div>
      </>
    )
  }

  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Display language' })
  expect(screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })).toHaveFocus()

  fireEvent.pointerDown(screen.getByTestId('outside'))

  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).not.toHaveFocus()
})
