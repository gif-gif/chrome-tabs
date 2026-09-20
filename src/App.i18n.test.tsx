import { readFileSync } from 'node:fs'
import * as csstree from 'css-tree'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { Header } from './components/Header'
import { createTranslator } from './i18n/i18n'
import { windows } from './test/fixtures'
import type { ChromeTabsApi } from './types'

const UI_PREFERENCES_KEY = 'chrome-tabs.ui-preferences.v1'
const stylesSource = readFileSync('src/styles.css', 'utf8')

interface CssRuleRecord {
  media: string | null
  selector: string
  declarations: Map<string, string>
}

function collectCssRules(): CssRuleRecord[] {
  const stylesheet = csstree.parse(stylesSource, { context: 'stylesheet' })
  const records: CssRuleRecord[] = []

  function collect(children: csstree.List<csstree.CssNode>, media: string | null) {
    children.forEach((node) => {
      if (node.type === 'Rule') {
        const declarations = new Map<string, string>()
        node.block.children.forEach((child) => {
          if (child.type === 'Declaration') {
            declarations.set(child.property, csstree.generate(child.value).trim())
          }
        })
        records.push({
          media,
          selector: csstree.generate(node.prelude),
          declarations,
        })
        return
      }

      if (node.type === 'Atrule' && node.block) {
        collect(
          node.block.children,
          node.prelude ? csstree.generate(node.prelude) : '',
        )
      }
    })
  }

  if (stylesheet.type !== 'StyleSheet') {
    throw new Error('Expected stylesheet AST')
  }
  collect(stylesheet.children, null)
  return records
}

const cssRules = collectCssRules()

function declarationsFor(selector: string, media: string | null = null) {
  const rule = cssRules.find(
    (candidate) => candidate.selector === selector && candidate.media === media,
  )
  if (!rule) {
    throw new Error(`Missing CSS rule ${selector} in ${media ?? 'base stylesheet'}`)
  }
  return rule.declarations
}

function setBrowserLanguages(languages: readonly string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages)
}

async function chooseLanguage(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionName: string,
) {
  await user.click(screen.getByRole('button', { name: triggerName }))
  await user.click(screen.getByRole('menuitemradio', { name: optionName }))
}


async function setToolbarScroll(
  container: HTMLElement,
  scrollTop: number,
  toolbarName: string,
) {
  const toolbar = screen.getByRole('toolbar', { name: toolbarName })
  const search = within(toolbar).getByRole('searchbox')
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement && activeElement.closest('.toolbar-auxiliary')) {
    fireEvent.blur(activeElement, { relatedTarget: search })
    fireEvent.focus(search)
  }
  const scrollContainer = container.querySelector('.popup-content') as HTMLElement
  scrollContainer.scrollTop = scrollTop
  fireEvent.scroll(scrollContainer)
  await waitFor(() =>
    expect(screen.getByRole('toolbar', { name: toolbarName })).toHaveAttribute(
      'data-compact',
      scrollTop >= 64 ? 'true' : 'false',
    ),
  )
}

function createApi(): ChromeTabsApi {
  return {
    queryWindows: vi.fn(async () => windows),
    activateTab: vi.fn(async () => undefined),
    closeTab: vi.fn(async () => undefined),
    moveTabs: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App internationalization', () => {
  it('shows the numeric count and always-visible English short filter labels with complete names', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(
      <Header
        t={createTranslator('en')}
        count={41}
        filter="all"
        globalMasked={false}
        onFilterChange={onFilterChange}
        onToggleMask={vi.fn()}
      />,
    )

    const count = screen.getByText('41')
    expect(count).toHaveTextContent(/^41$/)
    expect(count).toHaveAttribute('title', '41 tabs')
    expect(count).toHaveAttribute('aria-label', '41 tabs')
    expect(screen.queryByText('41 tabs')).not.toBeInTheDocument()

    const allButton = screen.getByRole('button', { name: 'All tabs' })
    const currentButton = screen.getByRole('button', { name: 'Current window' })
    const activeButton = screen.getByRole('button', { name: 'Active tabs' })
    expect(allButton.querySelector('.compact-filter-label')).toHaveTextContent(/^All$/)
    expect(currentButton.querySelector('.compact-filter-label')).toHaveTextContent(/^Current$/)
    expect(activeButton.querySelector('.compact-filter-label')).toHaveTextContent(/^Active$/)
    expect(allButton).toHaveAttribute('title', 'All tabs')
    expect(currentButton).toHaveAttribute('title', 'Current window')
    expect(activeButton).toHaveAttribute('title', 'Active tabs')
    expect(allButton).toHaveAttribute('aria-pressed', 'true')
    expect(currentButton).toHaveAttribute('aria-pressed', 'false')
    expect(activeButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(allButton)
    await user.click(currentButton)
    await user.click(activeButton)
    expect(onFilterChange.mock.calls).toEqual([
      ['all'],
      ['current-window'],
      ['active'],
    ])
  })

  it.each([
    { languages: ['zh-TW'], toolbar: '标签页工具栏', lang: 'zh-CN' },
    { languages: ['en-US'], toolbar: 'Tab toolbar', lang: 'en' },
    { languages: ['fr-FR'], toolbar: 'Tab toolbar', lang: 'en' },
  ])('resolves automatic browser language for $languages', async ({ languages, toolbar, lang }) => {
    setBrowserLanguages(languages)
    render(<App api={createApi()} />)

    expect(await screen.findByRole('toolbar', { name: toolbar })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe(lang)
  })

  it('places an accessible globe language menu in the auxiliary toolbar', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const { container } = render(<App api={createApi()} />)
    const toolbar = await screen.findByRole('toolbar', { name: 'Tab toolbar' })
    expect(within(toolbar).queryByRole('combobox')).not.toBeInTheDocument()

    const trigger = within(toolbar).getByRole('button', { name: 'Display language' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('title', 'Display language')
    expect(trigger.closest('.toolbar-summary')).toBeInTheDocument()
    expect(container.querySelector('.sticky-controls')).toContainElement(trigger)

    await user.click(trigger)
    const menu = screen.getByRole('menu', { name: 'Display language' })
    expect(menu.parentElement).toHaveClass('language-menu-root')
    expect(menu.parentElement?.parentElement).toHaveClass('app-header-actions')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByRole('menuitemradio', { name: 'Auto (browser language)' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByRole('menuitemradio', { name: '中文' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitemradio', { name: 'English' })).toBeInTheDocument()
  })

  it('navigates and dismisses the language menu with the keyboard and outside pointer', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await screen.findByRole('toolbar', { name: 'Tab toolbar' })
    const trigger = screen.getByRole('button', { name: 'Display language' })

    await user.click(trigger)
    const automaticOption = screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })
    expect(automaticOption).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(automaticOption).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: '中文' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())

    await user.click(trigger)
    await user.keyboard('{ArrowDown}{Enter}')
    const translatedTrigger = screen.getByRole('button', { name: '显示语言' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(translatedTrigger).toHaveFocus()
    expect(document.documentElement.lang).toBe('zh-CN')

    await user.click(translatedTrigger)
    const englishOption = screen.getByRole('menuitemradio', { name: 'English' })
    englishOption.focus()
    fireEvent.keyDown(englishOption, { key: ' ', code: 'Space' })
    const englishTrigger = screen.getByRole('button', { name: 'Display language' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(englishTrigger).toHaveFocus()
    expect(document.documentElement.lang).toBe('en')

    await user.click(englishTrigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps the first row expanded while a language item is focused, then restores the latest compact scroll state', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const { container } = render(<App api={createApi()} />)
    const toolbar = await screen.findByRole('toolbar', { name: 'Tab toolbar' })
    const trigger = within(toolbar).getByRole('button', { name: 'Display language' })
    const search = within(toolbar).getByRole('searchbox', { name: 'Search tabs' })
    const scrollContainer = container.querySelector('.popup-content') as HTMLElement

    await user.click(trigger)
    const automaticOption = screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })
    expect(automaticOption).toHaveFocus()

    scrollContainer.scrollTop = 64
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'false'))
    expect(trigger.closest('.toolbar-auxiliary')).not.toHaveAttribute('aria-hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(toolbar).toHaveAttribute('data-compact', 'false')

    fireEvent.blur(trigger, { relatedTarget: search })
    fireEvent.focus(search)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'true'))
    expect(trigger.closest('.toolbar-auxiliary')).toHaveAttribute('aria-hidden', 'true')
  })

  it('resumes compact scrolling after an outside pointer closes a focused language menu', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const { container } = render(<App api={createApi()} />)
    const toolbar = await screen.findByRole('toolbar', { name: 'Tab toolbar' })
    const trigger = within(toolbar).getByRole('button', { name: 'Display language' })
    const scrollContainer = container.querySelector('.popup-content') as HTMLElement
    const outside = container.querySelector('.popup-shell') as HTMLElement

    await user.click(trigger)
    const automaticOption = screen.getByRole('menuitemradio', { name: 'Auto (browser language)' })
    expect(automaticOption).toHaveFocus()

    scrollContainer.scrollTop = 64
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'false'))

    fireEvent.pointerDown(outside)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).not.toHaveFocus()

    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'true'))
    expect(trigger.closest('.toolbar-auxiliary')).toHaveAttribute('aria-hidden', 'true')
  })

  it('switches manually without resetting search, filter, view, collapse, or privacy state and persists the preference', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await screen.findByText('GitHub - Chrome Tabs')

    const search = screen.getByRole('searchbox', { name: 'Search tabs' })
    await user.type(search, 'github')
    await user.click(screen.getByRole('button', { name: 'Active tabs' }))
    await user.click(screen.getByRole('button', { name: 'Group by domain view' }))
    await user.click(screen.getByRole('button', { name: 'Hide all tab information' }))
    const maskedGroup = screen.getByRole('region', { name: /Website group 1/ })
    const groupToggle = within(maskedGroup).getByRole('button', { expanded: true })
    await user.click(groupToggle)
    expect(groupToggle).toHaveAttribute('aria-expanded', 'false')

    await chooseLanguage(user, 'Display language', '中文')

    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toHaveValue('github')
    expect(screen.getByRole('button', { name: '活动标签' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '域名分组视图' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '显示全部标签信息' })).toBeInTheDocument()
    const translatedMaskedGroup = screen.getByRole('region', { name: /网站分组 1/ })
    expect(
      within(translatedMaskedGroup).getByRole('button', { expanded: false }),
    ).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('zh-CN')

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toMatchObject({
        globalMasked: true,
        viewMode: 'domain',
        language: 'zh-CN',
      })
    })
  })

  it('preserves the complete UI state through fully compact and fully restored scrolling', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const { container } = render(<App api={createApi()} />)
    await screen.findByText('GitHub - Chrome Tabs')

    const search = screen.getByRole('searchbox', { name: 'Search tabs' })
    await user.type(search, 'example')
    await user.click(screen.getByRole('button', { name: 'Current window' }))
    await user.click(screen.getByRole('button', { name: 'Group by domain view' }))
    const exampleGroupBeforeMask = screen.getByRole('region', { name: /example\.com/ })
    const mailRow = within(exampleGroupBeforeMask).getByText('Mail Inbox').closest('li')
    expect(mailRow).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Hide all tab information' }))
    await user.click(
      within(mailRow as HTMLElement).getByRole('button', {
        name: 'Show this tab information',
      }),
    )
    const group = screen.getByRole('region', { name: /example\.com/ })
    await user.click(within(group).getByRole('button', { expanded: true }))
    await chooseLanguage(user, 'Display language', '中文')

    await setToolbarScroll(container, 64, '标签页工具栏')
    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toHaveValue('example')
    await setToolbarScroll(container, 0, '标签页工具栏')

    expect(screen.getByRole('button', { name: '当前窗口' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '域名分组视图' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '显示全部标签信息' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '显示语言' })).toHaveAttribute('aria-expanded', 'false')
    const restoredGroup = screen.getByRole('region', { name: /example\.com/ })
    const restoredToggle = within(restoredGroup).getByRole('button', { expanded: false })
    await user.click(restoredToggle)
    expect(within(restoredGroup).getByText('Mail Inbox')).toBeInTheDocument()
    expect(
      within(restoredGroup).getByRole('button', { name: '隐藏此标签信息' }),
    ).toBeInTheDocument()
  })

  it('returns to auto, restores a saved manual language after remount, and updates html lang', async () => {
    setBrowserLanguages(['zh-CN'])
    const user = userEvent.setup()
    const first = render(<App api={createApi()} />)
    await screen.findByRole('toolbar', { name: '标签页工具栏' })
    await chooseLanguage(user, '显示语言', 'English')
    expect(await screen.findByRole('toolbar', { name: 'Tab toolbar' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    first.unmount()

    render(<App api={createApi()} />)
    expect(await screen.findByRole('toolbar', { name: 'Tab toolbar' })).toBeInTheDocument()
    await chooseLanguage(user, 'Display language', 'Auto (browser language)')
    expect(await screen.findByRole('toolbar', { name: '标签页工具栏' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('translates English search, filters, grouping, status, confirmation, and operation errors', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App api={api} />)
    await screen.findByLabelText('3 tabs')

    expect(screen.getByPlaceholderText('Search titles or URLs…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All tabs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current window' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active tabs' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Copy tab link' })).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Group by domain view' }))
    const googleGroup = screen.getByRole('region', { name: /example.com/ })
    await user.click(within(googleGroup).getByRole('button', { name: 'Close 2 tabs in example.com group' }))
    expect(confirm).toHaveBeenCalledWith('Close 2 tabs in this group?')

    expect(screen.queryByRole('button', { name: 'Close side panel' })).not.toBeInTheDocument()
  })


  it('keeps a per-tab privacy override when the language changes', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const { container } = render(<App api={createApi()} />)
    await screen.findByText('GitHub - Chrome Tabs')

    const githubRow = screen.getByText('GitHub - Chrome Tabs').closest('li')
    expect(githubRow).not.toBeNull()
    await user.click(
      within(githubRow as HTMLElement).getByRole('button', {
        name: 'Hide this tab information',
      }),
    )
    expect(screen.getAllByText('Information hidden')).toHaveLength(1)
    expect(container.innerHTML).not.toContain('GitHub - Chrome Tabs')
    expect(screen.getByText('Mail Inbox')).toBeInTheDocument()

    await chooseLanguage(user, 'Display language', '中文')

    expect(screen.getAllByText('内容已隐藏')).toHaveLength(1)
    expect(container.innerHTML).not.toContain('GitHub - Chrome Tabs')
    expect(screen.getByText('Mail Inbox')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: '显示此标签信息' }),
    ).toHaveLength(1)
  })

  it('keeps a tab operation pending across language changes and prevents duplicate calls', async () => {
    setBrowserLanguages(['en-US'])
    let resolveActivation!: () => void
    const activation = new Promise<void>((resolve) => {
      resolveActivation = resolve
    })
    const api = createApi()
    api.activateTab = vi.fn(() => activation)
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)
    await screen.findByText('Mail Inbox')

    await user.click(screen.getByRole('button', { name: 'Mail Inbox' }))
    expect(api.activateTab).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Mail Inbox' })).toBeDisabled()
    const pendingRow = screen.getByText('Mail Inbox').closest('li')
    expect(pendingRow).toHaveAttribute('aria-busy', 'true')
    expect(
      within(pendingRow as HTMLElement).getByRole('button', { name: 'Close tab' }),
    ).toBeDisabled()

    await chooseLanguage(user, 'Display language', '中文')

    const pendingButton = screen.getByRole('button', { name: 'Mail Inbox' })
    await setToolbarScroll(container, 64, '标签页工具栏')
    await setToolbarScroll(container, 0, '标签页工具栏')
    expect(pendingButton).toBeDisabled()
    expect(pendingRow).toHaveAttribute('aria-busy', 'true')
    expect(
      within(pendingRow as HTMLElement).getByRole('button', { name: '关闭标签页' }),
    ).toBeDisabled()
    await user.click(pendingButton)
    expect(api.activateTab).toHaveBeenCalledTimes(1)

    resolveActivation()
    await waitFor(() => expect(pendingButton).not.toBeDisabled())
  })

  it('keeps an operation error visible and immediately relocalizes it', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    api.activateTab = vi.fn(async () => {
      throw new Error('private activation details')
    })
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)
    await screen.findByText('Mail Inbox')

    await user.click(screen.getByRole('button', { name: 'Mail Inbox' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Unable to switch to this tab. Please try again.',
    )

    await chooseLanguage(user, 'Display language', '中文')

    expect(screen.getByRole('status')).toHaveTextContent(
      '无法切换到该标签页，请重试。',
    )
    await setToolbarScroll(container, 64, '标签页工具栏')
    await setToolbarScroll(container, 0, '标签页工具栏')
    expect(screen.getByRole('status')).toHaveTextContent(
      '无法切换到该标签页，请重试。',
    )
    expect(container.innerHTML).not.toContain('private activation details')
  })

  it('keeps a query error active and immediately translates it after a language change', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    api.queryWindows = vi.fn(async () => {
      throw new Error('private query details')
    })
    const user = userEvent.setup()
    const { container, unmount } = render(<App api={api} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load tabs. Please try again.',
    )
    await chooseLanguage(user, 'Display language', '中文')
    expect(screen.getByRole('alert')).toHaveTextContent(
      '无法加载标签页，请重试。',
    )
    await setToolbarScroll(container, 64, '标签页工具栏')
    await setToolbarScroll(container, 0, '标签页工具栏')
    expect(screen.getByRole('alert')).toHaveTextContent(
      '无法加载标签页，请重试。',
    )
    expect(container.innerHTML).not.toContain('private query details')
    unmount()
  })

  it('keeps a subscription error active and immediately translates it after a language change', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    api.subscribe = vi.fn(() => {
      throw new Error('private subscription details')
    })
    const user = userEvent.setup()
    const { container, unmount } = render(<App api={api} />)
    await screen.findByText('GitHub - Chrome Tabs')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Live synchronization is temporarily unavailable. Please try again.',
    )
    await chooseLanguage(user, 'Display language', '中文')
    expect(screen.getByRole('alert')).toHaveTextContent(
      '实时同步暂时不可用，请重试。',
    )
    await setToolbarScroll(container, 64, '标签页工具栏')
    await setToolbarScroll(container, 0, '标签页工具栏')
    expect(screen.getByRole('alert')).toHaveTextContent(
      '实时同步暂时不可用，请重试。',
    )
    expect(container.innerHTML).not.toContain('private subscription details')
    unmount()
  })

  it('shows a safe English activation failure without exposing the exception', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    api.activateTab = vi.fn(async () => {
      throw new Error('private activateTab exception')
    })
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)
    await screen.findByText('Mail Inbox')

    await user.click(screen.getByRole('button', { name: 'Mail Inbox' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Unable to switch to this tab. Please try again.',
    )
    expect(container.innerHTML).not.toContain('private activateTab exception')
  })

  it('shows a safe English single-tab close failure without exposing the exception', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    api.closeTab = vi.fn(async () => {
      throw new Error('private closeTab exception')
    })
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)
    await screen.findByText('GitHub - Chrome Tabs')

    const githubRow = screen.getByText('GitHub - Chrome Tabs').closest('li')
    expect(githubRow).not.toBeNull()
    await user.click(
      within(githubRow as HTMLElement).getByRole('button', { name: 'Close tab' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Unable to close this tab. Please try again.',
    )
    expect(container.innerHTML).not.toContain('private closeTab exception')
  })

  it('shows a safe English group-close failure without exposing the exception', async () => {
    setBrowserLanguages(['en-US'])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const api = createApi()
    api.closeTab = vi.fn(async () => {
      throw new Error('private group close exception')
    })
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)
    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: 'Group by domain view' }))
    const exampleGroup = screen.getByRole('region', { name: /example.com/ })

    await user.click(
      within(exampleGroup).getByRole('button', {
        name: 'Close 2 tabs in example.com group',
      }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Unable to close this group. Please try again.',
    )
    expect(container.innerHTML).not.toContain('private group close exception')
  })

  it('localizes safe query and subscription errors without exposing private exception text', async () => {
    setBrowserLanguages(['en-US'])
    const queryApi = createApi()
    queryApi.queryWindows = vi.fn(async () => {
      throw new Error('private query failure')
    })
    const first = render(<App api={queryApi} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load tabs. Please try again.',
    )
    expect(first.container.innerHTML).not.toContain('private query failure')
    first.unmount()

    const subscriptionApi = createApi()
    subscriptionApi.subscribe = vi.fn(() => {
      throw new Error('private subscription failure')
    })
    const second = render(<App api={subscriptionApi} />)
    await screen.findByText('GitHub - Chrome Tabs')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Live synchronization is temporarily unavailable. Please try again.',
    )
    expect(second.container.innerHTML).not.toContain('private subscription failure')
  })

  it('does not leak masked titles, URLs, favicons, domains, or sensitive aria text in English', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const { container } = render(<App api={createApi()} />)
    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: 'Hide all tab information' }))
    await user.click(screen.getByRole('button', { name: 'Group by domain view' }))

    expect(container.innerHTML).not.toContain('GitHub - Chrome Tabs')
    expect(container.innerHTML).not.toContain('TOKEN=SECRET')
    expect(container.innerHTML).not.toContain('github.com')
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getAllByText('Information hidden').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: /Website group 1/ })).toBeInTheDocument()
  })
})

describe('compact progressive sticky toolbar CSS contract', () => {
  it('uses a two-row compact layout with a collapsible auxiliary row', () => {
    const sticky = declarationsFor('.sticky-controls')
    expect(sticky.get('--sticky-search-progress')).toBe('0')
    expect(sticky.get('--toolbar-summary-expanded-height')).toBe('32px')

    const auxiliary = declarationsFor('.toolbar-auxiliary')
    expect(auxiliary.get('opacity')).toBe('calc(1 - var(--sticky-search-progress))')
    expect(auxiliary.get('transform')).toBe('translateY(calc(-8px*var(--sticky-search-progress)))')

    const summary = declarationsFor('.toolbar-summary')
    expect(summary.get('max-height')).toBe('calc(var(--toolbar-summary-expanded-height)*(1 - var(--sticky-search-progress)))')
    expect(summary.get('margin-bottom')).toBe('calc(8px*(1 - var(--sticky-search-progress)))')

    const header = declarationsFor('.app-header')
    expect(header.get('display')).toBe('flex')
    expect(header.get('white-space')).toBe('nowrap')

    const hidden = declarationsFor('.toolbar-auxiliary.is-hidden')
    expect(hidden.get('pointer-events')).toBe('none')
    expect(hidden.get('visibility')).toBe('hidden')
  })

  it('keeps search and fixed-size view buttons in the permanent sticky row', () => {
    const searchRow = declarationsFor('.search-row')
    expect(searchRow.get('display')).toBe('flex')
    expect(searchRow.get('min-width')).toBe('0')

    const search = declarationsFor('.search-box')
    expect(search.get('flex')).toBe('1 1 auto')
    expect(search.get('min-width')).toBe('0')
    expect(search.get('height')).toBe('36px')

    const root = declarationsFor(':root')
    expect(root.get('--compact-control-size')).toBe('28px')

    const compactButton = declarationsFor('.compact-icon-button')
    expect(compactButton.get('width')).toBe('var(--compact-control-size)')
    expect(compactButton.get('min-width')).toBe('var(--compact-control-size)')
    expect(compactButton.get('height')).toBe('var(--compact-control-size)')

    const toolbarIcons = declarationsFor('.compact-filter-button>svg,.compact-icon-button>svg')
    expect(toolbarIcons.get('width')).toBe('16px')
    expect(toolbarIcons.get('height')).toBe('16px')

    const popup = declarationsFor('.popup-content')
    expect(popup.get('overflow-x')).toBe('hidden')
    expect(popup.get('overflow-y')).toBe('auto')
  })


  it('scopes compact background-free row actions without changing generic icon buttons', () => {
    const root = declarationsFor(':root')
    expect(root.get('--row-action-size')).toBe('26px')

    const rowAction = declarationsFor('.row-action-button')
    expect(rowAction.get('width')).toBe('var(--row-action-size)')
    expect(rowAction.get('min-width')).toBe('var(--row-action-size)')
    expect(rowAction.get('height')).toBe('var(--row-action-size)')
    expect(rowAction.get('background')).toBe('transparent')

    const rowIcons = declarationsFor('.row-action-button>svg')
    expect(rowIcons.get('width')).toBe('15px')
    expect(rowIcons.get('height')).toBe('15px')

    for (const selector of [
      '.row-action-button:hover:not(:disabled)',
      '.row-action-button:active:not(:disabled)',
      '.row-action-button:focus-visible',
    ]) {
      expect(declarationsFor(selector).get('background')).toBe('transparent')
    }

    expect(declarationsFor('.domain-group-action:hover:not(:disabled),.domain-group-action:focus-visible').get('background')).toBe('var(--color-hover)')
    expect(declarationsFor('.domain-group-action:active:not(:disabled)').get('background')).toBe('var(--color-pressed)')
    expect(declarationsFor('.domain-group-action.row-close-action:hover:not(:disabled),.domain-group-action.row-close-action:focus-visible').get('background')).toBe('var(--color-danger-soft)')

    const focus = declarationsFor('.row-action-button:focus-visible')
    expect(focus.get('outline')).toBe('2px solid var(--color-focus)')
    expect(focus.get('outline-offset')).toBe('1px')

    expect(declarationsFor('.row-privacy-action:hover:not(:disabled),.row-privacy-action:focus-visible').get('color')).toBe('var(--color-text)')
    expect(declarationsFor('.row-close-action:hover:not(:disabled),.row-close-action:focus-visible').get('color')).toBe('var(--color-danger)')
  })

  it('anchors the language menu to the full action row and keeps it inside narrow viewports', () => {
    const actions = declarationsFor('.app-header-actions')
    expect(actions.get('position')).toBe('relative')

    const root = declarationsFor('.language-menu-root')
    expect(root.get('position')).toBe('static')

    const menu = declarationsFor('.language-menu')
    expect(menu.get('position')).toBe('absolute')
    expect(menu.get('right')).toBe('0')
    expect(menu.get('width')).toBe('190px')
    expect(menu.get('max-width')).toBe('calc(100vw - 2*var(--panel-gutter))')
    expect(menu.get('z-index')).toBe('40')
    expect(declarationsFor('.toolbar-summary').get('overflow')).toBe('visible')
    expect(declarationsFor('.sticky-controls').get('overflow')).toBe('visible')
    expect(declarationsFor(':root').get('--panel-gutter')).toBe('clamp(8px, 3vw, 16px)')
    expect(declarationsFor(':root', '(max-width:340px)').get('--panel-gutter')).toBe('8px')

    for (const viewportWidth of [420, 340, 300, 280]) {
      const panelGutter = viewportWidth <= 340
        ? 8
        : Math.min(16, Math.max(8, viewportWidth * 0.03))
      const containingBlockRight = viewportWidth - panelGutter
      const menuWidth = Math.min(190, viewportWidth - (2 * panelGutter))
      const menuLeft = containingBlockRight - menuWidth
      const menuRight = menuLeft + menuWidth

      expect(menuLeft, `${viewportWidth}px menu left edge`).toBeGreaterThanOrEqual(0)
      expect(menuRight, `${viewportWidth}px menu right edge`).toBeLessThanOrEqual(viewportWidth)
    }
  })

  it('shares compact semantics with reduced motion while never hiding the search row', () => {
    const media = '(prefers-reduced-motion:reduce)'
    expect(declarationsFor('.toolbar-auxiliary', media).get('transition')).toBe('none')
    const expanded = declarationsFor('.sticky-controls[data-compact="false"] .toolbar-auxiliary', media)
    expect(expanded.get('max-height')).toBe('var(--toolbar-summary-expanded-height)')
    expect(expanded.get('margin-bottom')).toBe('8px')
    const compact = declarationsFor('.sticky-controls[data-compact="true"] .toolbar-auxiliary', media)
    expect(compact.get('max-height')).toBe('0')
    expect(compact.get('margin-block')).toBe('0')
    expect(cssRules.some((rule) => rule.selector.includes('.search-row') && rule.declarations.get('visibility') === 'hidden')).toBe(false)
  })

  it('uses segmented pills and keeps all short labels visible at narrow widths', () => {
    const count = declarationsFor('.tab-count')
    expect(count.get('display')).toBe('inline-grid')
    expect(count.get('flex')).toBe('0 0 auto')
    expect(count.get('min-width')).toBe('28px')
    expect(count.get('height')).toBe('24px')
    expect(count.get('padding')).toBe('0 8px')
    expect(count.get('color')).toBe('var(--color-accent)')
    expect(count.get('background')).toBe('var(--color-accent-soft)')
    expect(count.get('border-radius')).toBe('999px')
    expect(count.get('font-weight')).toBe('700')
    expect(count.get('font-variant-numeric')).toBe('tabular-nums')
    expect(count.has('overflow')).toBe(false)
    expect(count.has('text-overflow')).toBe(false)

    const filters = declarationsFor('.compact-filter-group')
    expect(filters.get('height')).toBe('30px')
    expect(filters.get('padding')).toBe('2px')
    expect(filters.get('gap')).toBe('2px')
    expect(filters.get('margin-left')).toBe('10px')
    expect(filters.get('background')).toBe('var(--color-hover)')
    expect(filters.get('border-radius')).toBe('999px')

    const filterButton = declarationsFor('.compact-filter-button')
    expect(filterButton.get('height')).toBe('26px')
    expect(filterButton.get('min-width')).toBe('0')
    expect(filterButton.get('padding')).toBe('0 7px')
    expect(filterButton.get('background')).toBe('transparent')
    expect(filterButton.get('border-radius')).toBe('999px')

    const selected = declarationsFor('.compact-filter-button.is-active')
    expect(selected.get('color')).toBe('var(--color-accent)')
    expect(selected.get('background')).toBe('var(--color-surface)')
    expect(selected.get('box-shadow')).toBe('0 1px 2px rgb(60 64 67/18%)')

    const viewModeSelected = declarationsFor('.view-mode-switch button[aria-pressed="true"]')
    expect(viewModeSelected.get('background')).toBe('var(--color-accent-soft)')

    const actions = declarationsFor('.app-header-actions')
    expect(actions.get('position')).toBe('relative')
    expect(actions.get('margin-left')).toBe('auto')

    const media340 = '(max-width:340px)'
    expect(declarationsFor('.app-header', media340).get('gap')).toBe('1px')
    const media340HeaderIndex = cssRules.findIndex(
      (rule) => rule.media === media340 && rule.selector === '.app-header',
    )
    const media420HeaderIndex = cssRules.findIndex(
      (rule) => rule.media === '(max-width:420px)' && rule.selector === '.app-header',
    )
    expect(media340HeaderIndex).toBeGreaterThan(media420HeaderIndex)
    expect(declarationsFor('.tab-count', media340).get('padding-inline')).toBe('5px')
    expect(declarationsFor('.compact-filter-group', media340).get('margin-left')).toBe('3px')
    expect(declarationsFor('.compact-filter-group', media340).get('gap')).toBe('0')
    expect(declarationsFor('.compact-filter-group', media340).get('padding-inline')).toBe('1px')
    expect(declarationsFor('.compact-filter-button', media340).get('gap')).toBe('0')
    expect(declarationsFor('.compact-filter-button', media340).get('padding-inline')).toBe('3px')
    expect(declarationsFor('.compact-filter-button>svg', media340).get('display')).toBe('none')
    expect(declarationsFor('.app-header-actions', media340).get('gap')).toBe('0')
    expect(declarationsFor('.compact-icon-button', media340).get('width')).toBe('24px')
    expect(declarationsFor('.compact-icon-button', media340).get('min-width')).toBe('24px')
    expect(declarationsFor('.compact-icon-button').get('height')).toBe('var(--compact-control-size)')

    const hiddenLabelRules = cssRules.filter(
      (rule) =>
        rule.selector.includes('.compact-filter-label') &&
        (rule.declarations.get('display') === 'none' ||
          rule.declarations.get('visibility') === 'hidden'),
    )
    expect(hiddenLabelRules).toHaveLength(0)
    expect(
      cssRules.some(
        (rule) =>
          rule.media === '(max-width:300px)' &&
          (rule.selector.includes('.compact-filter-label') ||
            rule.selector.includes('.compact-filter-button.is-active')),
      ),
    ).toBe(false)

    const availableHeaderWidth = 280 - (2 * 8)
    const threeDigitCountWidth = Math.max(28, (3 * 7.2) + (2 * 5))
    const englishFilterTextWidth = ('All'.length + 'Current'.length + 'Active'.length) * 7.2
    const filterButtonPaddingWidth = 3 * (2 * 3)
    const filterGroupWidth = 3 + 1 + englishFilterTextWidth + filterButtonPaddingWidth + 1
    const actionButtonsWidth = 3 * 24
    const headerChildrenGaps = 2 * 1
    const worstCaseHeaderWidth =
      threeDigitCountWidth + filterGroupWidth + actionButtonsWidth + headerChildrenGaps

    expect(availableHeaderWidth).toBe(264)
    expect(worstCaseHeaderWidth).toBeLessThanOrEqual(availableHeaderWidth)
    expect(declarationsFor('.app-header').get('white-space')).toBe('nowrap')
  })
})
