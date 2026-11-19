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
    openTabInNewWindow: vi.fn(async () => undefined),
    moveTabs: vi.fn(async () => undefined),
    capturePage: vi.fn(async () => ({ html: '<p>Page</p>', url: 'https://example.com/', title: 'Page' })),
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
  it('shows only the English icon actions without a tab count or filter tabs', () => {
    const { container } = render(
      <Header
        t={createTranslator('en')}
        globalMasked={false}
        onToggleMask={vi.fn()}
      />,
    )

    expect(container.querySelector('.tab-count')).not.toBeInTheDocument()
    expect(container.querySelector('.app-header')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Hide all tab information' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All tabs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Favorite tabs' })).not.toBeInTheDocument()
  })

  it.each([
    { languages: ['zh-CN'], toolbar: '标签页工具栏', lang: 'zh-CN' },
    { languages: ['zh-TW'], toolbar: '分頁工具列', lang: 'zh-TW' },
    { languages: ['zh-HK'], toolbar: '分頁工具列', lang: 'zh-TW' },
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
    expect(within(menu).getByRole('menuitemradio', { name: '简体中文' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitemradio', { name: '繁體中文' })).toBeInTheDocument()
    expect(within(menu).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Auto (browser language)',
      '简体中文',
      '繁體中文',
      'English',
    ])
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
    expect(screen.getByRole('menuitemradio', { name: '简体中文' })).toHaveFocus()
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

  it('switches manually without resetting search, view, collapse, or privacy state and persists the preference', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await screen.findByText('GitHub - Chrome Tabs')

    const search = screen.getByRole('searchbox', { name: 'Search tabs' })
    await user.type(search, 'github')
    await user.click(screen.getByRole('button', { name: 'Group by domain view' }))
    await user.click(screen.getByRole('button', { name: 'Hide all tab information' }))
    const maskedGroup = screen.getByRole('region', { name: /Website group 1/ })
    const groupToggle = within(maskedGroup).getByRole('button', { expanded: true })
    await user.click(groupToggle)
    expect(groupToggle).toHaveAttribute('aria-expanded', 'false')

    await chooseLanguage(user, 'Display language', '简体中文')

    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toHaveValue('github')
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
    expect(screen.queryByRole('button', { name: 'Current window' })).not.toBeInTheDocument()
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
    await chooseLanguage(user, 'Display language', '简体中文')

    await setToolbarScroll(container, 64, '标签页工具栏')
    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toHaveValue('example')
    await setToolbarScroll(container, 0, '标签页工具栏')

    expect(screen.queryByRole('button', { name: '当前窗口' })).not.toBeInTheDocument()
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

  it('switches to Traditional Chinese manually and restores it after remount', async () => {
    setBrowserLanguages(['en-US'])
    const user = userEvent.setup()
    const first = render(<App api={createApi()} />)
    await screen.findByRole('toolbar', { name: 'Tab toolbar' })
    await chooseLanguage(user, 'Display language', '繁體中文')
    expect(await screen.findByRole('toolbar', { name: '分頁工具列' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜尋分頁' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('zh-TW')
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toMatchObject({
        language: 'zh-TW',
      })
    })
    first.unmount()

    render(<App api={createApi()} />)
    expect(await screen.findByRole('toolbar', { name: '分頁工具列' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '顯示語言' }))
    expect(screen.getByRole('menuitemradio', { name: '繁體中文' })).toHaveAttribute('aria-checked', 'true')
  })

  it('translates English search, grouping, status, confirmation, and operation errors', async () => {
    setBrowserLanguages(['en-US'])
    const api = createApi()
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App api={api} />)
    await waitFor(() => expect(document.querySelectorAll('.tab-row')).toHaveLength(3))

    expect(screen.getByPlaceholderText('Search titles or URLs…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All tabs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Current window' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Active tabs' })).not.toBeInTheDocument()
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

    await chooseLanguage(user, 'Display language', '简体中文')

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

    await chooseLanguage(user, 'Display language', '简体中文')

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

    await chooseLanguage(user, 'Display language', '简体中文')

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
    await chooseLanguage(user, 'Display language', '简体中文')
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
    await chooseLanguage(user, 'Display language', '简体中文')
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

    const clear = declarationsFor('.search-clear')
    expect(clear.get('background')).toBe('transparent')
    expect(clear.get('border')).toBe('0')
    expect(clear.get('width')).toBe('24px')
    expect(clear.get('height')).toBe('24px')

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

    const toolbarIcons = declarationsFor('.compact-icon-button>svg')
    expect(toolbarIcons.get('width')).toBe('16px')
    expect(toolbarIcons.get('height')).toBe('16px')

    const popup = declarationsFor('.popup-content')
    expect(popup.get('overflow-x')).toBe('hidden')
    expect(popup.get('overflow-y')).toBe('auto')
  })


  it('sets group headers apart from tab rows in light and dark schemes', () => {
    const light = declarationsFor(':root')
    const dark = declarationsFor(':root[data-color-scheme="dark"]')
    expect(light.get('--color-group-header')).toBe('#eceef2')
    expect(dark.get('--color-group-header')).toBe('#3c3f44')
    expect(light.get('--color-group-marker')).toBe('var(--color-accent)')

    for (const selector of ['.domain-group-heading', '.window-toggle']) {
      const header = declarationsFor(selector)
      expect(header.get('background')).toBe('var(--color-group-header)')
      expect(header.get('box-shadow')).toBe('inset 3px 0 0 var(--color-group-marker)')
    }
    expect(declarationsFor('.domain-group-heading .window-toggle').get('box-shadow')).toBe('none')
    expect(declarationsFor('.window-toggle:hover').get('background')).toBe('var(--color-group-header-hover)')
    expect(declarationsFor('.window-toggle:active').get('background')).toBe('var(--color-group-header-pressed)')
    expect(declarationsFor('.domain-group-heading:has(.window-toggle:active)').get('background')).toBe('var(--color-group-header-pressed)')

    expect(declarationsFor('.window-toggle>span:first-of-type').get('font-weight')).toBe('600')
    const count = declarationsFor('.window-toggle>span:last-child')
    expect(count.get('color')).toBe('var(--color-text)')
    expect(count.get('background')).toBe('var(--color-group-count)')
    expect(declarationsFor('.tab-list').get('padding')).toBe('0')
  })

  it('runs tab rows edge to edge across the group card', () => {
    expect(declarationsFor('.window-group').get('overflow')).toBe('hidden')
    const row = declarationsFor('.tab-row')
    expect(row.get('margin')).toBe('0')
    expect(row.get('padding')).toBe('2px 8px 2px 10px')
    expect(row.get('border-bottom')).toBe('1px solid var(--color-border-subtle)')
    expect(declarationsFor('.tab-row:last-child').get('border-bottom')).toBe('0')
    expect(declarationsFor('.tab-row:last-child').has('border-bottom-left-radius')).toBe(false)
    expect(cssRules.some((rule) => rule.selector === '.tab-row:first-child')).toBe(false)
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

    expect(declarationsFor('.domain-group-heading:hover').get('background')).toBe('var(--color-group-header-hover)')
    expect(declarationsFor(
      '.domain-group-heading .window-toggle:hover,.domain-group-heading .window-toggle:active,.domain-group-heading .custom-group-drag-handle:hover:not(:disabled),.domain-group-heading .domain-group-action:hover:not(:disabled),.domain-group-heading .domain-group-action:active:not(:disabled),.domain-group-heading .domain-group-action.row-close-action:hover:not(:disabled)',
    ).get('background')).toBe('transparent')

    const hover = '(hover:hover)'
    expect(declarationsFor('.tab-row', hover).get('display')).toBe('flex')
    const collapsed = declarationsFor(
      '.tab-row .row-action-button:not(.is-pinned,.is-copied),.domain-group-heading .domain-group-action:not(.is-pinned,.is-active)',
      hover,
    )
    expect(collapsed.get('width')).toBe('0')
    expect(collapsed.get('overflow')).toBe('hidden')
    expect(declarationsFor(
      '.tab-row .row-action-button:not(.is-pinned,.is-copied)>svg,.domain-group-heading .domain-group-action:not(.is-pinned,.is-active)>svg',
      hover,
    ).get('opacity')).toBe('0')
    expect(declarationsFor(
      '.tab-row:hover .row-action-button,.tab-row:has(:focus-visible) .row-action-button,.domain-group-heading:hover .domain-group-action,.domain-group-heading:has(:focus-visible) .domain-group-action',
      hover,
    ).get('width')).toBe('var(--row-action-size)')
    expect(declarationsFor(
      '.tab-row:has(.is-pinned) :is(.row-pin-action,.row-close-action),.domain-group-heading:not(.has-drag-handle):has(.row-pin-action.is-pinned) :is(.row-pin-action,.row-deduplicate-action,.row-close-action),.domain-group-heading.has-drag-handle:has(.row-pin-action.is-pinned) :is(.row-pin-action,.row-close-action)',
      hover,
    ).get('width')).toBe('var(--row-action-size)')
    expect(declarationsFor(
      '.tab-row:hover .row-action-button>svg,.tab-row:has(:focus-visible) .row-action-button>svg,.domain-group-heading:hover .domain-group-action>svg,.domain-group-heading:has(:focus-visible) .domain-group-action>svg',
      hover,
    ).get('opacity')).toBe('1')

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

  it('keeps the compact header controls quiet and within narrow widths without filter tabs', () => {
    expect(cssRules.some((rule) => rule.selector.includes('.tab-count'))).toBe(false)

    expect(cssRules.some((rule) => rule.selector.includes('.compact-filter'))).toBe(false)
    expect(declarationsFor(':root').get('--radius-sm')).toBe('4px')
    expect(declarationsFor(':root').get('--radius-md')).toBe('6px')

    const viewModeSelected = declarationsFor('.view-mode-switch button[aria-pressed="true"]')
    expect(viewModeSelected.get('background')).toBe('var(--color-hover)')

    const activeTab = declarationsFor('.tab-row.is-active')
    expect(activeTab.get('background')).toContain('var(--color-accent-soft)')
    expect(activeTab.has('border')).toBe(false)
    expect(activeTab.has('box-shadow')).toBe(false)
    expect(cssRules.some((rule) => rule.selector === '.tab-row.is-active::before')).toBe(false)

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
    expect(declarationsFor('.app-header-actions', media340).get('gap')).toBe('0')
    expect(declarationsFor('.compact-icon-button', media340).get('width')).toBe('24px')
    expect(declarationsFor('.compact-icon-button', media340).get('min-width')).toBe('24px')
    expect(declarationsFor('.compact-icon-button').get('height')).toBe('var(--compact-control-size)')

    const availableHeaderWidth = 280 - (2 * 8)
    const actionButtonsWidth = 3 * 24
    const worstCaseHeaderWidth = actionButtonsWidth

    expect(availableHeaderWidth).toBe(264)
    expect(worstCaseHeaderWidth).toBeLessThanOrEqual(availableHeaderWidth)
    expect(declarationsFor('.app-header').get('white-space')).toBe('nowrap')
  })
})
