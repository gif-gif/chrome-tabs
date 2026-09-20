import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import type { BrowserWindow, ChromeTabsApi, DisplayTab, DisplayWindow } from './types'
import { Header } from './components/Header'
import { Icon, type IconName } from './components/Icon'
import { SearchFilters } from './components/SearchFilters'
import { TabRow } from './components/TabRow'
import { WindowGroup } from './components/WindowGroup'
import { StatusView } from './components/StatusView'
import { App } from './App'
import { createSafeChromeTabsApi } from './chrome/chromeTabs'
import { windows as fixtureWindows } from './test/fixtures'
import { createTranslator } from './i18n/i18n'

const UI_PREFERENCES_KEY = 'chrome-tabs.ui-preferences.v1'
const stylesSource = readFileSync('src/styles.css', 'utf8')
const zh = createTranslator('zh-CN')
let clipboardWriteText: ReturnType<typeof vi.fn>

function storeUiPreferences(globalMasked: boolean) {
  localStorage.setItem(
    UI_PREFERENCES_KEY,
    JSON.stringify({
      version: 1,
      globalMasked,
      viewMode: 'list',
      language: 'auto',
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  clipboardWriteText = vi.fn().mockResolvedValue(undefined)
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-CN'])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const unmaskedTab: DisplayTab = {
  id: 1,
  windowId: 10,
  index: 0,
  active: true,
  masked: false,
  displayTitle: 'OpenAI',
  displayUrl: 'https://openai.com',
  displayFavIconUrl:
    '/_favicon/?pageUrl=https%3A%2F%2Fopenai.com&size=32',
}

const originalTitle = 'OpenAI'
const originalUrl = 'https://openai.com'
const originalFaviconUrl = 'https://openai.com/favicon.ico'
const localFaviconUrl = `/_favicon/?pageUrl=${encodeURIComponent(originalUrl)}&size=32`

const maskedTab: DisplayTab = {
  ...unmaskedTab,
  id: 2,
  active: false,
  masked: true,
  displayTitle: '内容已隐藏',
  displayUrl: '',
  displayFavIconUrl: undefined,
}

const displayWindow: DisplayWindow = {
  id: 10,
  focused: true,
  label: '当前窗口',
  tabs: [unmaskedTab, maskedTab],
}

describe('Icon', () => {
  it('renders every supported icon as a hidden currentColor SVG', () => {
    const names: IconName[] = [
      'search',
      'close',
      'copy',
      'pin',
      'eye',
      'eye-off',
      'chevron',
      'chevron-left',
      'chevron-right',
      'tab',
      'refresh',
      'clear',
      'all-tabs',
      'window',
      'active-tab',
      'globe',
      'palette',
      'list',
      'group',
      'collapse-all',
      'expand-all',
      'check',
      'star',
      'deduplicate',
      'sort-domain',
    ]

    const { container } = render(
      <>
        {names.map((name) => (
          <Icon key={name} name={name} data-testid={name} />
        ))}
      </>,
    )

    expect(container.querySelectorAll('svg')).toHaveLength(names.length)
    for (const name of names) {
      const icon = screen.getByTestId(name)
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('stroke', 'currentColor')
    }
    expect(container).not.toHaveTextContent(/[\p{Extended_Pictographic}]/u)
  })
})

describe('Header', () => {
  it('renders a compact count and icon-only dynamic global privacy action', async () => {
    const user = userEvent.setup()
    const onToggleMask = vi.fn()

    const { container, rerender } = render(
      <Header t={zh} count={41} filter="all" globalMasked onFilterChange={vi.fn()} onToggleMask={onToggleMask} />,
    )

    expect(screen.queryByText('标签页管理器')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    const count = screen.getByText('41')
    expect(count).toHaveTextContent(/^41$/)
    expect(count).toHaveAttribute('title', '41 个标签页')
    expect(count).toHaveAttribute('aria-label', '41 个标签页')
    expect(screen.queryByText('41 个标签页')).not.toBeInTheDocument()
    const revealButton = screen.getByRole('button', {
      name: '显示全部标签信息',
    })
    expect(revealButton).toHaveTextContent('')
    expect(revealButton).toHaveAttribute('title', '显示全部标签信息')
    const revealIcon = revealButton.querySelector('svg')
    expect(revealIcon).toHaveAttribute('width', '16')
    expect(revealIcon).toHaveAttribute('height', '16')

    for (const name of ['全部标签页', '当前窗口', '活动标签']) {
      const filterButton = screen.getByRole('button', { name })
      expect(filterButton.querySelector('svg')).toHaveAttribute('width', '16')
      expect(filterButton.querySelector('svg')).toHaveAttribute('height', '16')
    }

    await user.click(revealButton)
    expect(onToggleMask).toHaveBeenCalledTimes(1)

    rerender(<Header t={zh} count={41} filter="all" globalMasked={false} onFilterChange={vi.fn()} onToggleMask={onToggleMask} />)
    const hideButton = screen.getByRole('button', {
      name: '隐藏全部标签信息',
    })
    expect(hideButton).toHaveTextContent('')
    expect(hideButton).toHaveAttribute('title', '隐藏全部标签信息')
    expect(container).not.toHaveTextContent('标签页管理器')
  })
})

describe('SearchFilters', () => {
  it('calls controlled query and view callbacks and clears on Escape', async () => {
    const user = userEvent.setup()
    const onQueryChange = vi.fn()
    const onViewModeChange = vi.fn()

    const { rerender } = render(
      <SearchFilters
        t={zh}
        query=""
        viewMode="list"
        onQueryChange={onQueryChange}
        onViewModeChange={onViewModeChange}
      />,
    )

    expect(screen.getByRole('search', { name: '搜索和显示模式' })).toBeInTheDocument()
    const input = screen.getByRole('searchbox', { name: '搜索标签页' })
    expect(input).toHaveAttribute('placeholder', '搜索标题或网址…')
    await user.type(input, 'docs')
    expect(onQueryChange).toHaveBeenLastCalledWith('s')

    rerender(
      <SearchFilters
        t={zh}
        query="docs"
        viewMode="list"
        onQueryChange={onQueryChange}
        onViewModeChange={onViewModeChange}
      />,
    )
    await user.keyboard('{Escape}')
    expect(onQueryChange).toHaveBeenLastCalledWith('')
    await user.click(screen.getByRole('button', { name: '清除搜索' }))
    expect(onQueryChange).toHaveBeenLastCalledWith('')

    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    expect(onViewModeChange).toHaveBeenCalledWith('domain')
  })
})

describe('TabRow favicon safety', () => {
  it('does not put a remote favicon URL into the DOM when passed an unsafe display model', () => {
    const remoteFaviconUrl = 'https://tracker.example/favicon.ico?secret=1'
    const { container } = render(
      <TabRow t={zh}
        tab={{ ...unmaskedTab, displayFavIconUrl: remoteFaviconUrl }}
        onActivate={vi.fn()}
        onToggleMask={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container.innerHTML).not.toContain(remoteFaviconUrl)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('.tab-main svg')).toBeInTheDocument()
  })

  it('renders allowlisted local favicon sources but never renders one while masked', () => {
    const dataFaviconUrl = 'data:image/png;base64,iVBORw0KGgo='
    const { container, rerender } = render(
      <TabRow t={zh}
        tab={{ ...unmaskedTab, displayFavIconUrl: dataFaviconUrl }}
        onActivate={vi.fn()}
        onToggleMask={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('img')).toHaveAttribute('src', dataFaviconUrl)

    rerender(
      <TabRow t={zh}
        tab={{
          ...maskedTab,
          displayFavIconUrl: dataFaviconUrl,
        }}
        onActivate={vi.fn()}
        onToggleMask={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain(dataFaviconUrl)
  })
})

describe('TabRow', () => {
  it('renders masked content without private values, images, or nested buttons', () => {
    const { container } = render(
      <TabRow t={zh}
        tab={{ ...maskedTab, active: true }}
        onActivate={vi.fn()}
        onToggleMask={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const serializedMarkup = container.innerHTML
    expect(serializedMarkup).not.toContain(originalTitle)
    expect(serializedMarkup).not.toContain(originalUrl)
    expect(serializedMarkup).not.toContain(originalFaviconUrl)
    expect(container).not.toHaveTextContent(originalTitle)
    expect(container).not.toHaveTextContent(originalUrl)
    expect(container).not.toHaveAttribute('title', originalTitle)
    expect(container).not.toHaveAttribute('data-url', originalUrl)
    expect(screen.getByText('内容已隐藏')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '切换到隐藏的标签页，当前标签' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('button', { name: '显示此标签信息' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '显示此标签信息' }),
    ).toHaveTextContent('')
    expect(
      screen.getByRole('button', { name: '显示此标签信息' }),
    ).not.toHaveAttribute('title')
    expect(
      screen.getByRole('button', { name: '复制标签链接' }),
    ).toBeInTheDocument()

    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('button')).toBeNull()
    }
  })

  it('renders unmasked content and isolates row, privacy, and close actions', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const onTogglePin = vi.fn()
    const onToggleMask = vi.fn()
    const onCopy = vi.fn()
    const onClose = vi.fn()

    render(
      <TabRow t={zh}
        tab={unmaskedTab}
        onActivate={onActivate}
        onTogglePin={onTogglePin}
        onToggleMask={onToggleMask}
        onCopy={onCopy}
        onClose={onClose}
      />,
    )

    expect(screen.getByText(originalTitle)).toBeInTheDocument()
    expect(screen.getByText(originalUrl)).toBeInTheDocument()
    const favicon = document.querySelector('.tab-row img')
    expect(favicon).toHaveAttribute('src', localFaviconUrl)
    expect(favicon).not.toHaveAttribute('src', originalFaviconUrl)
    expect(favicon).toHaveAttribute('alt', '')
    expect(
      screen.getByRole('button', { name: '隐藏此标签信息' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '隐藏此标签信息' }),
    ).toHaveTextContent('')
    expect(
      screen.getByRole('button', { name: '隐藏此标签信息' }),
    ).not.toHaveAttribute('title')
    expect(screen.getByText('当前标签')).toHaveClass('current-label')
    expect(screen.getByText('当前标签').closest('li')).toHaveClass('is-active')
    expect(screen.getByRole('button', { name: `${originalTitle}，当前标签` })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(screen.getByRole('button', { name: `${originalTitle}，当前标签` }))
    expect(onActivate).toHaveBeenCalledTimes(1)

    const pinButton = screen.getByRole('button', { name: '置顶标签' })
    const privacyButton = screen.getByRole('button', { name: '隐藏此标签信息' })
    const copyButton = screen.getByRole('button', { name: '复制标签链接' })
    const closeButton = screen.getByRole('button', { name: '关闭标签页' })
    expect(pinButton).toHaveClass('row-action-button', 'row-pin-action')
    expect(pinButton).toHaveAttribute('aria-pressed', 'false')
    expect(privacyButton).toHaveClass('row-action-button', 'row-privacy-action')
    expect(copyButton).toHaveClass('row-action-button', 'row-copy-action')
    expect(closeButton).toHaveClass('row-action-button', 'row-close-action')
    for (const button of [pinButton, privacyButton, copyButton, closeButton]) {
      expect(button.querySelector('svg')).toHaveAttribute('width', '15')
      expect(button.querySelector('svg')).toHaveAttribute('height', '15')
    }

    await user.click(pinButton)
    expect(onTogglePin).toHaveBeenCalledWith(unmaskedTab)
    expect(onActivate).toHaveBeenCalledTimes(1)

    await user.click(privacyButton)
    expect(onToggleMask).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledTimes(1)

    await user.click(copyButton)
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledTimes(1)

    await user.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })
})

describe('WindowGroup', () => {
  it('shows the label and count, and hides rows when collapsed', async () => {
    const user = userEvent.setup()
    const onToggleCollapse = vi.fn()

    const { rerender } = render(
      <WindowGroup t={zh}
        window={displayWindow}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
        onActivate={vi.fn()}
        onToggleMask={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const group = screen.getByRole('region', { name: /当前窗口/ })
    expect(group).toHaveClass('window-group', 'window-list-group')
    expect(within(group).getByText('当前窗口')).toBeInTheDocument()
    expect(within(group).getByText('2 个标签页')).toBeInTheDocument()
    expect(within(group).getAllByRole('listitem')).toHaveLength(2)
    const disclosure = within(group).getByRole('button', { name: /当前窗口/ })
    const controlledListId = disclosure.getAttribute('aria-controls')
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(controlledListId).toBeTruthy()
    expect(document.getElementById(controlledListId ?? '')).toBe(
      within(group).getByRole('list'),
    )

    await user.click(within(group).getByRole('button', { name: /当前窗口/ }))
    expect(onToggleCollapse).toHaveBeenCalledWith(10)

    rerender(
      <WindowGroup t={zh}
        window={displayWindow}
        collapsed
        onToggleCollapse={onToggleCollapse}
        onActivate={vi.fn()}
        onToggleMask={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(within(group).getByRole('button', { name: /当前窗口/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(within(group).queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('StatusView', () => {
  it('renders loading, empty, fatal error, and nonblocking status states', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(<StatusView t={zh} state="loading" />)
    const loadingStatus = screen.getByRole('status')
    expect(loadingStatus).toHaveTextContent('正在加载标签页…')
    expect(loadingStatus).toHaveAttribute('aria-live', 'polite')

    rerender(<StatusView t={zh} state="empty" />)
    expect(screen.getByText('没有找到匹配的标签页')).toBeInTheDocument()
    expect(
      screen.getByText('请尝试清除搜索词或调整筛选条件。'),
    ).toBeInTheDocument()

    rerender(
      <StatusView t={zh}
        state="error"
        errorMessage="无法加载标签页，请重试。"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByText('无法加载标签页，请重试。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(<StatusView t={zh} state="ready" operationMessage="标签页已关闭" />)
    expect(screen.getByRole('status')).toHaveTextContent('标签页已关闭')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('renders a caller-provided safe error message without replacing operation feedback', () => {
    render(
      <StatusView t={zh}
        state="error"
        errorMessage="实时同步暂时不可用，请重试。"
        operationMessage="无法关闭该标签页，请重试。"
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      '实时同步暂时不可用，请重试。',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '无法关闭该标签页，请重试。',
    )
  })
})


function createTestApi(
  queryWindows: ChromeTabsApi['queryWindows'] = async () => fixtureWindows,
): ChromeTabsApi & {
  queryWindows: ReturnType<typeof vi.fn<ChromeTabsApi['queryWindows']>>
  activateTab: ReturnType<typeof vi.fn<ChromeTabsApi['activateTab']>>
  closeTab: ReturnType<typeof vi.fn<ChromeTabsApi['closeTab']>>
  moveTabs: ReturnType<typeof vi.fn<NonNullable<ChromeTabsApi['moveTabs']>>>
} {
  return {
    queryWindows: vi.fn(queryWindows),
    activateTab: vi.fn<ChromeTabsApi['activateTab']>(async () => undefined),
    closeTab: vi.fn<ChromeTabsApi['closeTab']>(async () => undefined),
    moveTabs: vi.fn<NonNullable<ChromeTabsApi['moveTabs']>>(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
  }
}

async function renderReadyApp(api = createTestApi()) {
  storeUiPreferences(true)
  const user = userEvent.setup()
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWriteText },
  })
  const view = render(<App api={api} />)
  await screen.findByLabelText('3 个标签页')
  await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(screen.queryByText('正在加载标签页…')).not.toBeInTheDocument(),
  )
  return { api, user, ...view }
}

describe('action popup shell CSS contract', () => {
  it('uses a compact popup viewport with an independently scrolling content area', () => {
    expect(stylesSource).toMatch(
      /html\s*\{[^}]*width:\s*420px;[^}]*height:\s*600px;[^}]*overflow:\s*hidden;/,
    )
    expect(stylesSource).toMatch(
      /body\s*\{[^}]*width:\s*420px;[^}]*height:\s*600px;[^}]*overflow:\s*hidden;/,
    )
    expect(stylesSource).toMatch(
      /#root\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/,
    )
    expect(stylesSource).not.toMatch(/width:\s*min\(420px, 100vw\)|height:\s*min\(600px, 100vh\)/)
    expect(stylesSource).toMatch(
      /\.popup-shell\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/,
    )
    expect(stylesSource).toMatch(
      /\.popup-content\s*\{[^}]*height:\s*100%;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/,
    )
    expect(stylesSource).not.toMatch(/\.drawer-rail|\.drawer-toggle|\.drawer-shell|\.drawer-content/)
    expect(stylesSource).toMatch(
      /\.tab-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) repeat\(5, var\(--row-action-size\)\);/,
    )
  })

  it('keeps classic as the default and defines light and dark alternate palettes', () => {
    expect(stylesSource).toMatch(/:root\s*\{[^}]*--color-accent:\s*#1a73e8;/)
    expect(stylesSource).toMatch(
      /:root\[data-theme="aurora"\]\s*\{[^}]*--color-bg:\s*#eef9f7;[^}]*--color-accent:\s*#0f766e;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="aurora"\]\s*\{[^}]*--color-bg:\s*#102523;[^}]*--color-accent:\s*#6ee7d4;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="sunset"\]\s*\{[^}]*--color-bg:\s*#fff8ed;[^}]*--color-accent:\s*#c2410c;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="sunset"\]\s*\{[^}]*--color-bg:\s*#241812;[^}]*--color-accent:\s*#fb923c;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="twilight"\]\s*\{[^}]*--color-bg:\s*#f7f3ff;[^}]*--color-accent:\s*#6d28d9;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="twilight"\]\s*\{[^}]*--color-bg:\s*#171322;[^}]*--color-accent:\s*#c4b5fd;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="ocean"\]\s*\{[^}]*--color-bg:\s*#eef7ff;[^}]*--color-accent:\s*#0369a1;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="ocean"\]\s*\{[^}]*--color-bg:\s*#0b1f2a;[^}]*--color-accent:\s*#7dd3fc;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="forest"\]\s*\{[^}]*--color-bg:\s*#f3f8ef;[^}]*--color-accent:\s*#3f6212;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="forest"\]\s*\{[^}]*--color-bg:\s*#121d12;[^}]*--color-accent:\s*#bef264;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="sakura"\]\s*\{[^}]*--color-bg:\s*#fff5f8;[^}]*--color-accent:\s*#be185d;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="sakura"\]\s*\{[^}]*--color-bg:\s*#26151e;[^}]*--color-accent:\s*#f9a8d4;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="graphite"\]\s*\{[^}]*--color-bg:\s*#f1f3f5;[^}]*--color-accent:\s*#374151;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="graphite"\]\s*\{[^}]*--color-bg:\s*#111418;[^}]*--color-accent:\s*#d1d5db;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="lemon"\]\s*\{[^}]*--color-bg:\s*#fffde8;[^}]*--color-accent:\s*#854d0e;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="lemon"\]\s*\{[^}]*--color-bg:\s*#211e0c;[^}]*--color-accent:\s*#fde047;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="coffee"\]\s*\{[^}]*--color-bg:\s*#f7f1eb;[^}]*--color-accent:\s*#7c3f20;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="coffee"\]\s*\{[^}]*--color-bg:\s*#1f1712;[^}]*--color-accent:\s*#d6a06d;/,
    )
    expect(stylesSource).toMatch(
      /:root\[data-theme="midnight"\]\s*\{[^}]*--color-bg:\s*#eef2ff;[^}]*--color-accent:\s*#3730a3;/,
    )
    expect(stylesSource).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\[data-theme="midnight"\]\s*\{[^}]*--color-bg:\s*#080f24;[^}]*--color-accent:\s*#60a5fa;/,
    )
    expect(stylesSource).toMatch(
      /\.theme-toggle\[aria-pressed="true"\]\s*\{[^}]*color:\s*var\(--color-accent\);[^}]*background:\s*var\(--color-accent-soft\);/,
    )
  })
})

describe('App integration', () => {
  it('renders the tab manager as a popup without an explicit Side Panel close control', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const { container } = render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    expect(container.querySelector('.popup-shell')).toBeInTheDocument()
    expect(container.querySelector('.popup-content')).toBeInTheDocument()
    expect(container.querySelector('.drawer-rail')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '关闭侧边栏' })).not.toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: '标签页工具栏' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toBeInTheDocument()
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toEqual({
        version: 1,
        globalMasked: false,
        viewMode: 'list',
        language: 'auto',
        theme: 'classic',
        pinnedTabIds: [],
        pinnedDomainKeys: [],
        favoriteUrls: [],
      }),
    )
  })

  it('keeps count, privacy, search, filters, and the view switch inside one sticky toolbar', async () => {
    const { container } = await renderReadyApp()

    expect(screen.queryByText('标签页管理器')).not.toBeInTheDocument()
    const toolbar = screen.getByRole('toolbar', { name: '标签页工具栏' })
    expect(toolbar).toHaveClass('sticky-controls')
    expect(within(toolbar).getByLabelText('3 个标签页')).toHaveTextContent(/^3$/)
    expect(
      within(toolbar).getByRole('button', { name: '显示全部标签信息' }),
    ).toHaveTextContent('')
    expect(
      within(toolbar).getByRole('searchbox', { name: '搜索标签页' }),
    ).toBeInTheDocument()
    expect(
      within(toolbar).getByRole('group', { name: '标签页筛选' }),
    ).toBeInTheDocument()
    const viewSwitch = within(toolbar).getByRole('group', {
      name: '标签页显示模式',
    })
    expect(
      within(viewSwitch).getByRole('button', { name: '列表视图' }),
    ).toBeInTheDocument()
    expect(
      within(viewSwitch).getByRole('button', { name: '域名分组视图' }),
    ).toBeInTheDocument()
    expect(container.querySelector('.sticky-controls')).toBe(toolbar)
  })

  it('always renders short filter labels with complete accessible names and unchanged callbacks', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(
      <Header
        t={zh}
        count={41}
        filter="all"
        globalMasked={false}
        onFilterChange={onFilterChange}
        onToggleMask={vi.fn()}
      />,
    )

    const filterGroup = screen.getByRole('group', { name: '标签页筛选' })
    const allButton = within(filterGroup).getByRole('button', { name: '全部标签页' })
    const currentWindowButton = within(filterGroup).getByRole('button', { name: '当前窗口' })
    const activeButton = within(filterGroup).getByRole('button', { name: '活动标签' })

    expect(allButton.querySelector('.compact-filter-label')).toHaveTextContent(/^全部$/)
    expect(currentWindowButton.querySelector('.compact-filter-label')).toHaveTextContent(/^当前$/)
    expect(activeButton.querySelector('.compact-filter-label')).toHaveTextContent(/^活动$/)
    expect(allButton).toHaveAttribute('title', '全部标签页')
    expect(currentWindowButton).toHaveAttribute('title', '当前窗口')
    expect(activeButton).toHaveAttribute('title', '活动标签')
    expect(allButton).toHaveAttribute('aria-pressed', 'true')
    expect(currentWindowButton).toHaveAttribute('aria-pressed', 'false')
    expect(activeButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(allButton)
    await user.click(currentWindowButton)
    await user.click(activeButton)
    expect(onFilterChange.mock.calls).toEqual([
      ['all'],
      ['current-window'],
      ['active'],
    ])
  })

  it('keeps list and domain view icon controls beside the search input', async () => {
    const { user } = await renderReadyApp()
    const searchRow = screen.getByRole('search', { name: '搜索和显示模式' })
    const listButton = within(searchRow).getByRole('button', { name: '列表视图' })
    const domainButton = within(searchRow).getByRole('button', { name: '域名分组视图' })

    expect(listButton).toHaveAttribute('aria-pressed', 'true')
    expect(listButton).toHaveAttribute('title', '列表视图')
    expect(listButton).toHaveTextContent('')
    expect(domainButton).toHaveAttribute('aria-pressed', 'false')
    expect(domainButton).toHaveAttribute('title', '域名分组视图')
    expect(domainButton).toHaveTextContent('')

    await user.click(domainButton)
    expect(domainButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('uses an icon-only control for collapsing all domain groups', async () => {
    storeUiPreferences(false)
    const user = userEvent.setup()
    render(<App api={createTestApi()} />)
    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))

    const collapse = screen.getByRole('button', { name: '全部折叠分组' })
    expect(collapse).toHaveAttribute('title', '全部折叠分组')
    expect(collapse).toHaveTextContent('')
    await user.click(collapse)
    expect(screen.getByRole('button', { name: '全部展开分组' })).toHaveTextContent('')
  })

  it('switches between list and domain views and persists the selected view mode', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    const view = render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('region', { name: /当前窗口/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '域名分组视图' }))

    expect(screen.getByRole('button', { name: '域名分组视图' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('region', { name: /github\.com/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /example\.com/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /当前窗口/ })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toMatchObject({
        version: 1,
        viewMode: 'domain',
        language: 'auto',
      }),
    )

    view.unmount()
    render(<App api={api} />)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: '域名分组视图' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('region', { name: /github\.com/ })).toBeInTheDocument()
  })

  it('pins and unpins tabs at the top of their window and persists the choice', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    const firstView = render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    const currentWindow = screen.getByRole('region', { name: /当前窗口/ })
    let rows = within(currentWindow).getAllByRole('listitem')
    expect(within(rows[0]).getByText('GitHub - Chrome Tabs')).toBeInTheDocument()

    await user.click(within(rows[1]).getByRole('button', { name: '置顶标签' }))
    rows = within(currentWindow).getAllByRole('listitem')
    expect(within(rows[0]).getByText('Mail Inbox')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('button', { name: '取消置顶标签' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toMatchObject({
      pinnedTabIds: [102],
    }))

    firstView.unmount()
    render(<App api={api} />)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    const restoredWindow = screen.getByRole('region', { name: /当前窗口/ })
    rows = within(restoredWindow).getAllByRole('listitem')
    expect(within(rows[0]).getByText('Mail Inbox')).toBeInTheDocument()

    await user.click(within(rows[0]).getByRole('button', { name: '取消置顶标签' }))
    rows = within(restoredWindow).getAllByRole('listitem')
    expect(within(rows[0]).getByText('GitHub - Chrome Tabs')).toBeInTheDocument()
  })

  it('pins domain groups first, persists the choice, and keeps masked markup private', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    const firstView = render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    const exampleGroup = screen.getByRole('region', { name: /example\.com/ })
    await user.click(within(exampleGroup).getByRole('button', { name: '置顶分组' }))
    let groups = [...document.querySelectorAll<HTMLElement>('.domain-group')]
    expect(groups[0]).toHaveTextContent('example.com')
    expect(within(groups[0]).getByRole('button', { name: '取消置顶分组' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toMatchObject({
      pinnedDomainKeys: ['example.com'],
    }))

    firstView.unmount()
    const restored = render(<App api={api} />)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    groups = [...restored.container.querySelectorAll<HTMLElement>('.domain-group')]
    expect(groups[0]).toHaveTextContent('example.com')

    await user.click(screen.getByRole('button', { name: '隐藏全部标签信息' }))
    expect(restored.container.innerHTML).not.toContain('example.com')
    expect(restored.container.innerHTML).not.toContain('github.com')
    expect(screen.getByRole('button', { name: '取消置顶分组' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('groups current filtered results across windows and keeps domain groups collapsible', async () => {
    storeUiPreferences(false)
    const groupedWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          {
            ...fixtureWindows[0].tabs[0],
            id: 1,
            url: 'https://docs.google.com/a',
          },
          { ...fixtureWindows[0].tabs[1], id: 2, url: 'https://example.com/a' },
        ],
      },
      {
        id: 20,
        focused: false,
        tabs: [
          {
            ...fixtureWindows[1].tabs[0],
            id: 3,
            url: 'https://drive.google.com/b',
          },
        ],
      },
    ]
    const api = createTestApi(async () => groupedWindows)
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))

    const googleGroup = screen.getByRole('region', { name: /google\.com/ })
    expect(within(googleGroup).getByText('2 个标签页')).toBeInTheDocument()
    expect(within(googleGroup).getAllByRole('listitem')).toHaveLength(2)

    const disclosure = within(googleGroup)
      .getAllByRole('button', { name: /google\.com.*2 个标签页/ })
      .find((button) => button.hasAttribute('aria-expanded'))
    if (!disclosure) {
      throw new Error('Expected google group disclosure button')
    }
    await user.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(within(googleGroup).queryAllByRole('listitem')).toHaveLength(0)

    await user.type(
      screen.getByRole('searchbox', { name: '搜索标签页' }),
      'example.com',
    )
    expect(screen.queryByRole('region', { name: /google\.com/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /example\.com/ })).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: '搜索标签页' }))
    const restoredGoogleDisclosure = within(
      screen.getByRole('region', { name: /google\.com/ }),
    )
      .getAllByRole('button', { name: /google\.com.*2 个标签页/ })
      .find((button) => button.hasAttribute('aria-expanded'))
    if (!restoredGoogleDisclosure) {
      throw new Error('Expected restored google group disclosure button')
    }
    expect(restoredGoogleDisclosure).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles privacy for only the current visible tabs in a domain group without changing global privacy', async () => {
    storeUiPreferences(false)
    const groupedWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...fixtureWindows[0].tabs[0], id: 1, url: 'https://docs.google.com/a', title: 'Google Docs A' },
          { ...fixtureWindows[0].tabs[1], id: 2, url: 'https://drive.google.com/b', title: 'Google Drive B' },
          { ...fixtureWindows[1].tabs[0], id: 3, windowId: 10, url: 'https://example.com/c', title: 'Example C' },
        ],
      },
    ]
    const api = createTestApi(async () => groupedWindows)
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('Google Docs A')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    await user.type(screen.getByRole('searchbox', { name: '搜索标签页' }), 'docs')

    const googleGroup = screen.getByRole('region', { name: /google\.com/ })
    expect(within(googleGroup).getAllByRole('listitem')).toHaveLength(1)
    const groupPrivacyButton = within(googleGroup).getByRole('button', { name: '隐藏此分组信息' })
    const groupCloseButton = within(googleGroup).getByRole('button', { name: '关闭 google.com 分组中的 1 个标签页' })
    expect(groupPrivacyButton).toHaveClass('row-action-button', 'row-privacy-action')
    expect(groupCloseButton).toHaveClass('row-action-button', 'row-close-action')
    for (const button of [groupPrivacyButton, groupCloseButton]) {
      expect(button.querySelector('svg')).toHaveAttribute('width', '15')
      expect(button.querySelector('svg')).toHaveAttribute('height', '15')
    }
    await user.click(groupPrivacyButton)

    expect(within(googleGroup).getByText('内容已隐藏')).toBeInTheDocument()
    expect(screen.queryByText('Google Docs A')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '隐藏全部标签信息' })).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: '搜索标签页' }))
    expect(screen.getByText('Google Drive B')).toBeInTheDocument()
    const fullGoogleGroup = screen.getByRole('region', { name: /google\.com/ })
    await user.click(within(fullGoogleGroup).getByRole('button', { name: '隐藏此分组信息' }))
    expect(within(fullGoogleGroup).getAllByText('内容已隐藏')).toHaveLength(2)
    await user.click(within(fullGoogleGroup).getByRole('button', { name: '显示此分组信息' }))
    expect(screen.getByText('Google Docs A')).toBeInTheDocument()
    expect(screen.getByText('Google Drive B')).toBeInTheDocument()
  })

  it('confirms before closing only the current visible tabs in a domain group', async () => {
    storeUiPreferences(false)
    const groupedWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...fixtureWindows[0].tabs[0], id: 1, url: 'https://docs.google.com/a', title: 'Google Docs A' },
          { ...fixtureWindows[0].tabs[1], id: 2, url: 'https://drive.google.com/b', title: 'Google Drive B' },
          { ...fixtureWindows[1].tabs[0], id: 3, windowId: 10, url: 'https://example.com/c', title: 'Example C' },
        ],
      },
    ]
    const api = createTestApi(async () => groupedWindows)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('Google Docs A')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    await user.type(screen.getByRole('searchbox', { name: '搜索标签页' }), 'docs')
    const googleGroup = screen.getByRole('region', { name: /google\.com/ })

    await user.click(within(googleGroup).getByRole('button', { name: '关闭 google.com 分组中的 1 个标签页' }))
    expect(confirm).toHaveBeenCalledWith('关闭该分组中的 1 个标签页？')
    expect(api.closeTab).not.toHaveBeenCalled()

    await user.click(within(googleGroup).getByRole('button', { name: '关闭 google.com 分组中的 1 个标签页' }))
    expect(confirm).toHaveBeenLastCalledWith('关闭该分组中的 1 个标签页？')
    await waitFor(() => expect(api.closeTab).toHaveBeenCalledTimes(1))
    expect(api.closeTab).toHaveBeenCalledWith(1)
    expect(api.closeTab).not.toHaveBeenCalledWith(2)
  })

  it('uses pending state and sanitized errors while closing a domain group', async () => {
    storeUiPreferences(false)
    const api = createTestApi(async () => [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...fixtureWindows[0].tabs[0], id: 1, url: 'https://docs.google.com/a', title: 'Google Docs A' },
          { ...fixtureWindows[0].tabs[1], id: 2, url: 'https://drive.google.com/b', title: 'Google Drive B' },
        ],
      },
    ])
    api.closeTab.mockRejectedValueOnce(new Error('Google private close failure'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)

    await screen.findByText('Google Docs A')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    const googleGroup = screen.getByRole('region', { name: /google\.com/ })
    const closeGroupButton = within(googleGroup).getByRole('button', { name: '关闭 google.com 分组中的 2 个标签页' })

    await user.click(closeGroupButton)
    await waitFor(() => expect(api.closeTab).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent(
      '无法关闭该分组，请重试。',
    )
    expect(container.innerHTML).not.toContain('Google private close failure')
  })

  it('places the domain collapse-all control directly beside the global privacy button only in domain mode', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    expect(
      screen.queryByRole('button', { name: '全部折叠分组' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '域名分组视图' }))

    const globalMaskButton = screen.getByRole('button', {
      name: '隐藏全部标签信息',
    })
    const toggleAllButton = screen.getByRole('button', { name: '全部折叠分组' })
    const headerActions = container.querySelector('.app-header-actions')

    expect(headerActions).toBeInTheDocument()
    expect(headerActions).toContainElement(globalMaskButton)
    expect(headerActions).toContainElement(toggleAllButton)
    expect(Array.from(headerActions!.children)).toEqual([
      screen.getByRole('button', { name: '按域名排列标签页' }),
      screen.getByRole('button', { name: '显示语言' }).closest('.language-menu-root'),
      screen.getByRole('button', { name: '切换到极光主题' }),
      globalMaskButton,
      toggleAllButton,
    ])
  })

  it('switches themes beside the language control and restores the choice after remount', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    const firstView = render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    const languageButton = screen.getByRole('button', { name: '显示语言' })
    const themeButton = screen.getByRole('button', { name: '切换到极光主题' })
    expect(languageButton.closest('.language-menu-root')?.nextElementSibling).toBe(themeButton)
    expect(document.documentElement).toHaveAttribute('data-theme', 'classic')

    const themeSequence = [
      ['aurora', '切换到暖阳主题'],
      ['sunset', '切换到暮紫主题'],
      ['twilight', '切换到海洋主题'],
      ['ocean', '切换到森林主题'],
      ['forest', '切换到樱花主题'],
      ['sakura', '切换到石墨主题'],
      ['graphite', '切换到柠檬主题'],
      ['lemon', '切换到咖啡主题'],
      ['coffee', '切换到午夜主题'],
      ['midnight', '切换到经典主题'],
    ] as const

    let currentButton = themeButton
    for (const [expectedTheme, nextThemeLabel] of themeSequence) {
      await user.click(currentButton)
      expect(document.documentElement).toHaveAttribute('data-theme', expectedTheme)
      currentButton = screen.getByRole('button', { name: nextThemeLabel })
      expect(currentButton).toHaveAttribute('aria-pressed', 'true')
    }
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toMatchObject({
        theme: 'midnight',
      }),
    )

    firstView.unmount()
    render(<App api={api} />)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    expect(document.documentElement).toHaveAttribute('data-theme', 'midnight')
    expect(screen.getByRole('button', { name: '切换到经典主题' })).toBeInTheDocument()
  })

  it('toggles all visible domain groups between collapsed and expanded with one toolbar button', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    const toggleAllButton = screen.getByRole('button', { name: '全部折叠分组' })
    const disclosures = () => screen.getAllByRole('button', { name: /个标签页/ }).filter((button) => button.hasAttribute('aria-expanded'))

    expect(disclosures()).toHaveLength(2)
    await user.click(toggleAllButton)
    for (const disclosure of disclosures()) {
      expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.getByRole('button', { name: '全部展开分组' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '全部展开分组' }))
    for (const disclosure of disclosures()) {
      expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    }
  })

  it('routes activation, per-tab privacy, and close actions through domain rows', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))

    await user.click(
      screen.getByRole('button', { name: 'GitHub - Chrome Tabs，当前标签' }),
    )
    expect(api.activateTab).toHaveBeenCalledWith(101, 10)

    const githubGroup = screen.getByRole('region', { name: /github\.com/ })
    await user.click(
      within(githubGroup).getByRole('button', { name: '隐藏此标签信息' }),
    )
    expect(within(githubGroup).getByText('内容已隐藏')).toBeInTheDocument()

    await user.click(
      within(githubGroup).getByRole('button', { name: '关闭标签页' }),
    )
    expect(api.closeTab).toHaveBeenCalledWith(101)
  })

  it('does not expose domain group headings while global privacy is enabled', async () => {
    const { container, user } = await renderReadyApp()

    await user.click(screen.getByRole('button', { name: '域名分组视图' }))

    const firstMaskedGroup = screen.getByRole('region', { name: /网站分组 1/ })
    expect(firstMaskedGroup).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /网站分组 2/ })).toBeInTheDocument()
    expect(
      within(firstMaskedGroup).getByRole('button', {
        name: '关闭 网站分组 1 分组中的 1 个标签页',
      }),
    ).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('github.com')
    expect(container.innerHTML).not.toContain('example.com')
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)
  })

  it('projects focused windows first and keeps every raw tab value out of the masked DOM', async () => {
    const api = createTestApi(async () => [...fixtureWindows].reverse())
    const { container } = await renderReadyApp(api)

    expect(screen.getByLabelText('3 个标签页')).toHaveTextContent(/^3$/)
    const groups = screen.getAllByRole('region', { name: /窗口/ })
    expect(within(groups[0]).getByText('当前窗口')).toBeInTheDocument()
    expect(within(groups[1]).getByText('窗口 2')).toBeInTheDocument()
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /切换到隐藏的标签页/ })).toHaveLength(3)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    for (const window of fixtureWindows) {
      for (const tab of window.tabs) {
        expect(container.innerHTML).not.toContain(tab.title)
        expect(container.innerHTML).not.toContain(tab.url)
        expect(container.innerHTML).not.toContain(tab.favIconUrl ?? '')
      }
    }
  })

  it('supports global and per-tab privacy overrides with global actions clearing overrides', async () => {
    const { user } = await renderReadyApp()

    await user.click(screen.getAllByRole('button', { name: '显示此标签信息' })[0])
    expect(screen.getByText('GitHub - Chrome Tabs')).toBeInTheDocument()
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '显示全部标签信息' }))
    expect(screen.getByText('GitHub - Chrome Tabs')).toBeInTheDocument()
    expect(screen.getByText('Mail Inbox')).toBeInTheDocument()
    expect(screen.getByText('Project Documentation')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '隐藏此标签信息' })[0])
    expect(screen.queryByText('GitHub - Chrome Tabs')).not.toBeInTheDocument()
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '隐藏全部标签信息' }))
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '显示全部标签信息' }))
    expect(screen.queryByText('内容已隐藏')).not.toBeInTheDocument()
    expect(screen.getByText('GitHub - Chrome Tabs')).toBeInTheDocument()
  })

  it('defaults to visible information and restores the persisted global mask', async () => {
    const api = createTestApi()
    const user = userEvent.setup()
    const firstView = render(<App api={api} />)

    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('GitHub - Chrome Tabs')).toBeInTheDocument()
    expect(screen.queryByText('内容已隐藏')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '隐藏全部标签信息' }))
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toEqual({
        version: 1,
        globalMasked: true,
        viewMode: 'list',
        language: 'auto',
        theme: 'classic',
        pinnedTabIds: [],
        pinnedDomainKeys: [],
        favoriteUrls: [],
      }),
    )

    firstView.unmount()
    render(<App api={api} />)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))

    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)
    expect(screen.queryByText('GitHub - Chrome Tabs')).not.toBeInTheDocument()
  })

  it('keeps per-tab privacy overrides in memory only across remounts', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const firstView = render(<App api={api} />)
    const user = userEvent.setup()

    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(1))
    await screen.findByText('GitHub - Chrome Tabs')
    await user.click(screen.getAllByRole('button', { name: '隐藏此标签信息' })[0])
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(1)

    firstView.unmount()
    render(<App api={api} />)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))

    expect(screen.queryByText('内容已隐藏')).not.toBeInTheDocument()
    expect(screen.getByText('GitHub - Chrome Tabs')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '')).toEqual({
      version: 1,
      globalMasked: false,
      viewMode: 'list',
      language: 'auto',
      theme: 'classic',
      pinnedTabIds: [],
      pinnedDomainKeys: [],
      favoriteUrls: [],
    })
  })

  it('searches raw values case-insensitively while masked and composes filters and collapse state', async () => {
    const { user } = await renderReadyApp()
    const search = screen.getByRole('searchbox', { name: '搜索标签页' })

    await user.type(search, 'token=secret')
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(1)
    expect(screen.getByRole('region', { name: /当前窗口/ })).toBeInTheDocument()
    expect(screen.queryByText('Mail Inbox')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'PROJECT DOCUMENTATION')
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(1)
    expect(screen.getByText('窗口 2')).toBeInTheDocument()

    await user.clear(search)
    await user.click(screen.getByRole('button', { name: '活动标签' }))
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '当前窗口' }))
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(2)
    expect(screen.queryByText('窗口 2')).not.toBeInTheDocument()

    const disclosure = screen.getByRole('button', { name: /当前窗口.*2 个标签页/ })
    await user.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: '全部标签页' }))
    expect(screen.getByRole('button', { name: /当前窗口.*2 个标签页/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('renders loading, query error, retry, and empty projections with generic copy', async () => {
    let resolveInitial!: (windows: BrowserWindow[]) => void
    const queryWindows = vi
      .fn<ChromeTabsApi['queryWindows']>()
      .mockImplementationOnce(
        () => new Promise<BrowserWindow[]>((resolve) => (resolveInitial = resolve)),
      )
      .mockRejectedValueOnce(new Error('private query failure'))
      .mockResolvedValueOnce([])
    const api = createTestApi(queryWindows)
    const user = userEvent.setup()
    storeUiPreferences(true)
    const { container } = render(<App api={api} />)

    expect(screen.getByText('正在加载标签页…')).toBeInTheDocument()
    resolveInitial(fixtureWindows)
    await screen.findByLabelText('3 个标签页')

    // A rejected operation forces the hook through its generic query error state.
    api.activateTab.mockRejectedValueOnce(new Error('GitHub - Chrome Tabs secret'))
    await user.click(screen.getAllByRole('button', { name: /切换到隐藏的标签页/ })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('无法加载标签页，请重试。')
    expect(container.innerHTML).not.toContain('private query failure')
    expect(container.innerHTML).not.toContain('GitHub - Chrome Tabs secret')

    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('没有找到匹配的标签页')).toBeInTheDocument()
  })

  it('shows a three-second checkmark after copying without revealing masked values or showing success text', async () => {
    const api = createTestApi()
    const { container, user } = await renderReadyApp(api)
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const copyButtons = screen.getAllByRole('button', { name: '复制标签链接' })
    const originalIconMarkup = copyButtons[1].innerHTML

    await user.click(copyButtons[1])
    expect(clipboardWriteText).toHaveBeenCalledWith(
      'https://mail.example.com/inbox?TOKEN=SECRET',
    )
    expect(api.activateTab).not.toHaveBeenCalled()
    await waitFor(() => expect(copyButtons[1]).toHaveAttribute('data-copied', 'true'))
    expect(copyButtons[1]).toHaveClass('is-copied')
    expect(copyButtons[1].innerHTML).not.toBe(originalIconMarkup)
    expect(screen.queryByText('链接已复制。')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain('TOKEN=SECRET')

    const resetCall = timeoutSpy.mock.calls.find(([, delay]) => delay === 3000)
    expect(resetCall).toBeDefined()
    act(() => {
      ;(resetCall?.[0] as () => void)()
    })
    expect(copyButtons[1]).not.toHaveAttribute('data-copied')
    expect(copyButtons[1]).not.toHaveClass('is-copied')
    expect(copyButtons[1].innerHTML).toBe(originalIconMarkup)

    clipboardWriteText.mockRejectedValueOnce(new Error('private clipboard failure'))
    await user.click(copyButtons[0])
    expect(await screen.findByRole('status')).toHaveTextContent(
      '无法复制链接，请重试。',
    )
    expect(screen.getByRole('status')).toHaveClass('is-error')
    expect(container.innerHTML).not.toContain('private clipboard failure')
  })

  it('runs activate and close operations, sanitizes failures, refreshes after rejection, and clears messages on success', async () => {
    const refreshedWindows: BrowserWindow[] = [
      {
        ...fixtureWindows[0],
        tabs: [fixtureWindows[0].tabs[1]],
      },
    ]
    const api = createTestApi(
      vi
        .fn<ChromeTabsApi['queryWindows']>()
        .mockResolvedValueOnce(fixtureWindows)
        .mockResolvedValue(refreshedWindows),
    )
    const { container, user } = await renderReadyApp(api)

    api.activateTab.mockRejectedValueOnce(new Error('Mail Inbox https://secret'))
    await user.click(screen.getAllByRole('button', { name: /切换到隐藏的标签页/ })[0])
    expect(api.activateTab).toHaveBeenCalledWith(101, 10)
    expect(await screen.findByRole('status')).toHaveTextContent(
      '无法切换到该标签页，请重试。',
    )
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    expect(container.innerHTML).not.toContain('https://secret')

    await user.click(screen.getByRole('button', { name: /切换到隐藏的标签页/ }))
    expect(api.activateTab).toHaveBeenLastCalledWith(102, 10)
    await waitFor(() =>
      expect(
        screen.queryByText('无法切换到该标签页，请重试。'),
      ).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: '显示此标签信息' }))
    expect(screen.getByText('Mail Inbox')).toBeInTheDocument()
    api.closeTab.mockRejectedValueOnce(new Error('Mail Inbox private close'))
    await user.click(screen.getByRole('button', { name: '关闭标签页' }))
    expect(api.closeTab).toHaveBeenCalledWith(102)
    expect(await screen.findByRole('status')).toHaveTextContent(
      '无法关闭该标签页，请重试。',
    )
    expect(container.innerHTML).not.toContain('private close')

    api.closeTab.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: '关闭标签页' }))
    await waitFor(() =>
      expect(screen.queryByText('Mail Inbox')).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByText('无法关闭该标签页，请重试。'),
    ).not.toBeInTheDocument()
  })

  it('prunes stale tab overrides and collapsed window IDs after refresh while preserving existing collapse', async () => {
    let listener: (() => void) | undefined
    let currentWindows = fixtureWindows
    const api = createTestApi(async () => currentWindows)
    api.subscribe = vi.fn((nextListener) => {
      listener = nextListener
      return () => undefined
    })
    const { user } = await renderReadyApp(api)

    await user.click(screen.getAllByRole('button', { name: '显示此标签信息' })[0])
    expect(screen.getByText('GitHub - Chrome Tabs')).toBeInTheDocument()
    const disclosure = screen.getByRole('button', { name: /当前窗口.*2 个标签页/ })
    await user.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')

    currentWindows = [fixtureWindows[0]]
    listener?.()
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: /当前窗口.*2 个标签页/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    currentWindows = [fixtureWindows[1]]
    listener?.()
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole('region', { name: /当前窗口/ })).not.toBeInTheDocument()

    currentWindows = fixtureWindows
    listener?.()
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(4))
    const restoredDisclosure = screen.getByRole('button', {
      name: /当前窗口.*2 个标签页/,
    })
    expect(restoredDisclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByText('GitHub - Chrome Tabs')).not.toBeInTheDocument()
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)
  })



  it('guards newer operation feedback and disables duplicate same-tab operations while pending', async () => {
    let resolveFirst!: () => void
    let rejectSecond!: (reason?: unknown) => void
    const api = createTestApi()
    api.activateTab
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveFirst = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise<void>((_, reject) => (rejectSecond = reject)),
      )
    const { user } = await renderReadyApp(api)
    const activationButtons = screen.getAllByRole('button', {
      name: /切换到隐藏的标签页/,
    })
    const closeButtons = screen.getAllByRole('button', { name: '关闭标签页' })
    const copyButtons = screen.getAllByRole('button', { name: '复制标签链接' })

    await user.click(activationButtons[0])
    expect(activationButtons[0]).toBeDisabled()
    expect(copyButtons[0]).toBeDisabled()
    expect(closeButtons[0]).toBeDisabled()
    await user.click(activationButtons[0])
    await user.click(copyButtons[0])
    await user.click(closeButtons[0])
    expect(api.activateTab).toHaveBeenCalledTimes(1)
    expect(clipboardWriteText).not.toHaveBeenCalled()
    expect(api.closeTab).not.toHaveBeenCalled()

    await user.click(activationButtons[1])
    expect(api.activateTab).toHaveBeenCalledTimes(2)
    rejectSecond(new Error('newer private failure'))
    expect(await screen.findByRole('status')).toHaveTextContent(
      '无法切换到该标签页，请重试。',
    )

    resolveFirst()
    await waitFor(() => expect(activationButtons[0]).not.toBeDisabled())
    expect(screen.getByRole('status')).toHaveTextContent(
      '无法切换到该标签页，请重试。',
    )
    expect(document.body.innerHTML).not.toContain('newer private failure')
  })

  it('shows the sanitized subscription error while keeping the last-good tabs visible', async () => {
    const api = createTestApi()
    api.subscribe = vi.fn(() => {
      throw new Error('private subscription failure')
    })
    const { container } = await renderReadyApp(api)

    expect(screen.getByRole('region', { name: /当前窗口/ })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '实时同步暂时不可用，请重试。',
    )
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('private subscription failure')
    expect(container.innerHTML).not.toContain('GitHub - Chrome Tabs')
  })

  it('keeps last-good window groups visible during a transient refresh error', async () => {
    let listener: (() => void) | undefined
    const api = createTestApi(
      vi
        .fn<ChromeTabsApi['queryWindows']>()
        .mockResolvedValueOnce(fixtureWindows)
        .mockRejectedValueOnce(new Error('private refresh details'))
        .mockResolvedValue(fixtureWindows),
    )
    api.subscribe = vi.fn((nextListener) => {
      listener = nextListener
      return () => undefined
    })
    const { container, user } = await renderReadyApp(api)

    listener?.()
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('region', { name: /当前窗口/ })).toBeInTheDocument()
    expect(screen.getAllByText('内容已隐藏')).toHaveLength(3)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '无法加载标签页，请重试。',
    )
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('private refresh details')
    expect(container.innerHTML).not.toContain('GitHub - Chrome Tabs')

    await user.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('region', { name: /当前窗口/ })).toBeInTheDocument()
  })

describe('unavailable Chrome API initialization', () => {
  it('renders the generic load error instead of throwing when App uses its default API', async () => {
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '无法加载标签页，请重试。',
    )
    expect(screen.queryByText(/Chrome 扩展 API 不可用/)).not.toBeInTheDocument()
  })

  it('converts an absent or invalid Chrome API into a stable safe adapter', async () => {
    const api = createSafeChromeTabsApi(undefined)
    const invalidApi = createSafeChromeTabsApi({} as typeof chrome)

    expect(api).toBe(createSafeChromeTabsApi(undefined))
    expect(invalidApi).toBe(api)
    await expect(api.queryWindows()).rejects.toBeInstanceOf(Error)
    await expect(api.activateTab(1, 1)).rejects.toBeInstanceOf(Error)
    await expect(api.closeTab(1)).rejects.toBeInstanceOf(Error)
    expect(api.subscribe(vi.fn())).toBeTypeOf('function')
  })
})

})

describe('progressive sticky search toolbar', () => {
  it('keeps one search input mounted while auxiliary controls hide and restore with scroll', async () => {
    const { container } = await renderReadyApp()
    const scrollContainer = container.querySelector('.popup-content') as HTMLElement
    const search = screen.getByRole('searchbox', { name: '搜索标签页' })
    const toolbar = screen.getByRole('toolbar', { name: '标签页工具栏' })
    const auxiliary = toolbar.querySelectorAll<HTMLElement>('.toolbar-auxiliary')

    expect(search).toBeInTheDocument()
    expect(auxiliary.length).toBeGreaterThan(0)
    expect(toolbar).toHaveAttribute('data-compact', 'false')

    scrollContainer.scrollTop = 64
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'true'))
    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toBe(search)
    expect(screen.getByRole('button', { name: '列表视图' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '域名分组视图' })).toBeEnabled()
    expect(screen.getByRole('search', { name: '搜索和显示模式' })).not.toHaveAttribute('aria-hidden')
    for (const element of auxiliary) {
      expect(element).toHaveAttribute('aria-hidden', 'true')
    }

    scrollContainer.scrollTop = 0
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'false'))
    expect(screen.getByRole('searchbox', { name: '搜索标签页' })).toBe(search)
    for (const element of auxiliary) {
      expect(element).not.toHaveAttribute('aria-hidden')
    }
  })

  it('protects focused auxiliary controls and restores the latest scroll state after focus leaves', async () => {
    const { container } = await renderReadyApp()
    const scrollContainer = container.querySelector('.popup-content') as HTMLElement
    const toolbar = screen.getByRole('toolbar', { name: '标签页工具栏' })
    const language = within(toolbar).getByRole('button', { name: '显示语言' })

    fireEvent.focus(language)
    scrollContainer.scrollTop = 64
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'false'))
    expect(language.closest('.toolbar-auxiliary')).not.toHaveAttribute('aria-hidden')

    fireEvent.blur(language, { relatedTarget: screen.getByRole('searchbox', { name: '搜索标签页' }) })
    fireEvent.focus(screen.getByRole('searchbox', { name: '搜索标签页' }))
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'true'))
    expect(language.closest('.toolbar-auxiliary')).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps toolbar controls non-interactive when fully hidden', async () => {
    const { container } = await renderReadyApp()
    const scrollContainer = container.querySelector('.popup-content') as HTMLElement
    const toolbar = screen.getByRole('toolbar', { name: '标签页工具栏' })
    scrollContainer.scrollTop = 64
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(toolbar).toHaveAttribute('data-compact', 'true'))

    for (const element of toolbar.querySelectorAll<HTMLElement>('.toolbar-auxiliary')) {
      expect(element).toHaveClass('is-hidden')
    }
  })

  it('keeps search state, view mode, and privacy state while scrolling in English', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    const { container } = render(<App api={api} />)
    await screen.findByLabelText('3 tabs')
    const search = screen.getByRole('searchbox', { name: 'Search tabs' })
    await user.type(search, 'github')
    await user.click(screen.getByRole('button', { name: 'Hide all tab information' }))

    const scrollContainer = container.querySelector('.popup-content') as HTMLElement
    scrollContainer.scrollTop = 56
    fireEvent.scroll(scrollContainer)
    await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Tab toolbar' })).toHaveAttribute('data-compact', 'false'))
    expect(screen.getByRole('searchbox', { name: 'Search tabs' })).toHaveValue('github')
    expect(screen.getByText('Information hidden')).toBeInTheDocument()
  })
  it('favorites tabs by URL, persists the choice, and filters to open favorites', async () => {
    storeUiPreferences(false)
    const api = createTestApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('GitHub - Chrome Tabs')
    const mailRow = screen.getByText('Mail Inbox').closest('.tab-row')
    expect(mailRow).toBeInTheDocument()
    await user.click(within(mailRow as HTMLElement).getByRole('button', { name: '收藏标签' }))

    expect(api.activateTab).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '取消收藏标签' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? '').favoriteUrls).toEqual([
        'https://mail.example.com/inbox?TOKEN=SECRET',
      ]),
    )

    await user.click(within(screen.getByRole('group', { name: '标签页筛选' })).getByRole('button', { name: '收藏标签' }))
    expect(screen.getByText('Mail Inbox')).toBeInTheDocument()
    expect(screen.queryByText('GitHub - Chrome Tabs')).not.toBeInTheDocument()
    expect(screen.queryByText('Project Documentation')).not.toBeInTheDocument()
  })

  it('removes later exact-URL duplicates from the full domain group after confirmation', async () => {
    storeUiPreferences(false)
    const duplicateUrl = 'https://docs.google.com/document/d/exact'
    const groupedWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...fixtureWindows[0].tabs[0], id: 1, index: 0, url: duplicateUrl, title: 'First copy' },
          { ...fixtureWindows[0].tabs[1], id: 2, index: 1, url: 'https://drive.google.com/unique', title: 'Unique' },
          { ...fixtureWindows[0].tabs[1], id: 3, index: 2, url: duplicateUrl, title: 'Second copy' },
          { ...fixtureWindows[0].tabs[1], id: 4, index: 3, url: `${duplicateUrl}?different=1`, title: 'Different query' },
        ],
      },
    ]
    const api = createTestApi(async () => groupedWindows)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByText('First copy')
    await user.click(screen.getByRole('button', { name: '域名分组视图' }))
    await user.type(screen.getByRole('searchbox', { name: '搜索标签页' }), 'First')
    const googleGroup = screen.getByRole('region', { name: /google\.com/ })
    const deduplicateButton = within(googleGroup).getByRole('button', {
      name: '移除 1 个重复标签页',
    })

    await user.click(deduplicateButton)
    expect(confirm).toHaveBeenCalledWith('关闭该分组中的 1 个重复标签页？')
    expect(api.closeTab).not.toHaveBeenCalled()

    await user.click(deduplicateButton)
    await waitFor(() => expect(api.closeTab).toHaveBeenCalledTimes(1))
    expect(api.closeTab).toHaveBeenCalledWith(3)
    expect(api.closeTab).not.toHaveBeenCalledWith(1)
    expect(api.closeTab).not.toHaveBeenCalledWith(4)
  })

  it('sorts native tabs into stable domain groups independently in each window', async () => {
    storeUiPreferences(false)
    const unsortedWindows: BrowserWindow[] = [
      {
        id: 10,
        focused: true,
        tabs: [
          { ...fixtureWindows[0].tabs[0], id: 1, index: 0, url: 'https://docs.google.com/a' },
          { ...fixtureWindows[0].tabs[1], id: 2, index: 1, url: 'https://example.com/a' },
          { ...fixtureWindows[0].tabs[1], id: 3, index: 2, url: 'https://drive.google.com/b' },
          { ...fixtureWindows[0].tabs[1], id: 4, index: 3, url: 'https://example.com/b' },
        ],
      },
      {
        id: 20,
        focused: false,
        tabs: [
          { ...fixtureWindows[1].tabs[0], id: 5, windowId: 20, index: 0, url: 'https://github.com/a' },
          { ...fixtureWindows[1].tabs[0], id: 6, windowId: 20, index: 1, url: 'https://github.com/b' },
        ],
      },
    ]
    const api = createTestApi(async () => unsortedWindows)
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByLabelText('6 个标签页')
    await user.click(screen.getByRole('button', { name: '按域名排列标签页' }))

    await waitFor(() => expect(api.moveTabs).toHaveBeenCalledTimes(1))
    expect(api.moveTabs).toHaveBeenCalledWith([1, 3, 2, 4], 10)
    expect(api.moveTabs).not.toHaveBeenCalledWith(expect.anything(), 20)
    await waitFor(() => expect(api.queryWindows).toHaveBeenCalledTimes(2))
  })

})
