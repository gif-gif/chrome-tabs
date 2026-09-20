export type SupportedLocale = 'zh-CN' | 'en'
export type UiLanguagePreference = 'auto' | SupportedLocale

const messages = {
  'zh-CN': {
    informationHidden: '内容已隐藏',
    maskedDomainGroup: '网站分组 {number}',
    otherPages: '其他页面',
    currentWindow: '当前窗口',
    numberedWindow: '窗口 {number}',
    queryError: '无法加载标签页，请重试。',
    subscriptionError: '实时同步暂时不可用，请重试。',
    activateError: '无法切换到该标签页，请重试。',
    closeTabError: '无法关闭该标签页，请重试。',
    closeGroupError: '无法关闭该分组，请重试。',
    closeGroupConfirm: '关闭该分组中的 {count} 个标签页？',
    toolbar: '标签页工具栏',
    expandAllGroups: '全部展开分组',
    collapseAllGroups: '全部折叠分组',
    expand: '展开',
    collapse: '折叠',
    viewMode: '标签页显示模式',
    listView: '列表视图',
    domainView: '域名分组视图',
    list: '列表',
    group: '分组',
    showAllInformation: '显示全部标签信息',
    hideAllInformation: '隐藏全部标签信息',
    tabCount: '{count} 个标签页',
    currentTab: '当前标签',
    currentTabSuffix: '，当前标签',
    activateMaskedTab: '切换到隐藏的标签页{current}',
    showTabInformation: '显示此标签信息',
    hideTabInformation: '隐藏此标签信息',
    closeTab: '关闭标签页',
    showGroupInformation: '显示此分组信息',
    hideGroupInformation: '隐藏此分组信息',
    closeDomainGroup: '关闭 {label} 分组中的 {count} 个标签页',
    loading: '正在加载标签页…',
    emptyTitle: '没有找到匹配的标签页',
    emptyHint: '请尝试清除搜索词或调整筛选条件。',
    retry: '重试',
    all: '全部',
    allTabs: '全部标签页',
    allShort: '全部',
    currentWindowFilter: '当前窗口',
    currentWindowShort: '当前',
    activeTabs: '活动标签',
    activeTabsShort: '活动',
    searchAndFilter: '搜索和筛选',
    searchAndView: '搜索和显示模式',
    searchTabs: '搜索标签页',
    searchPlaceholder: '搜索标题或网址…',
    clearSearch: '清除搜索',
    tabFilters: '标签页筛选',
    displayLanguage: '显示语言',
    autoLanguage: '自动（浏览器语言）',
    chineseLanguage: '中文',
    englishLanguage: 'English',
    switchToAuroraTheme: '切换到极光主题',
    switchToSunsetTheme: '切换到暖阳主题',
    switchToTwilightTheme: '切换到暮紫主题',
    switchToClassicTheme: '切换到经典主题',
  },
  en: {
    informationHidden: 'Information hidden',
    maskedDomainGroup: 'Website group {number}',
    otherPages: 'Other pages',
    currentWindow: 'Current window',
    numberedWindow: 'Window {number}',
    queryError: 'Unable to load tabs. Please try again.',
    subscriptionError: 'Live synchronization is temporarily unavailable. Please try again.',
    activateError: 'Unable to switch to this tab. Please try again.',
    closeTabError: 'Unable to close this tab. Please try again.',
    closeGroupError: 'Unable to close this group. Please try again.',
    closeGroupConfirm: 'Close {count} {count, plural, one {tab} other {tabs}} in this group?',
    toolbar: 'Tab toolbar',
    expandAllGroups: 'Expand all groups',
    collapseAllGroups: 'Collapse all groups',
    expand: 'Expand',
    collapse: 'Collapse',
    viewMode: 'Tab display mode',
    listView: 'List view',
    domainView: 'Group by domain view',
    list: 'List',
    group: 'Group',
    showAllInformation: 'Show all tab information',
    hideAllInformation: 'Hide all tab information',
    tabCount: '{count} {count, plural, one {tab} other {tabs}}',
    currentTab: 'Current tab',
    currentTabSuffix: ', current tab',
    activateMaskedTab: 'Switch to hidden tab{current}',
    showTabInformation: 'Show this tab information',
    hideTabInformation: 'Hide this tab information',
    closeTab: 'Close tab',
    showGroupInformation: 'Show this group information',
    hideGroupInformation: 'Hide this group information',
    closeDomainGroup: 'Close {count} {count, plural, one {tab} other {tabs}} in {label} group',
    loading: 'Loading tabs…',
    emptyTitle: 'No matching tabs found',
    emptyHint: 'Try clearing the search or changing the filters.',
    retry: 'Retry',
    all: 'All',
    allTabs: 'All tabs',
    allShort: 'All',
    currentWindowFilter: 'Current window',
    currentWindowShort: 'Current',
    activeTabs: 'Active tabs',
    activeTabsShort: 'Active',
    searchAndFilter: 'Search and filters',
    searchAndView: 'Search and view mode',
    searchTabs: 'Search tabs',
    searchPlaceholder: 'Search titles or URLs…',
    clearSearch: 'Clear search',
    tabFilters: 'Tab filters',
    displayLanguage: 'Display language',
    autoLanguage: 'Auto (browser language)',
    chineseLanguage: '中文',
    englishLanguage: 'English',
    switchToAuroraTheme: 'Switch to Aurora theme',
    switchToSunsetTheme: 'Switch to Sunset theme',
    switchToTwilightTheme: 'Switch to Twilight theme',
    switchToClassicTheme: 'Switch to Classic theme',
  },
} as const

export type TranslationKey = keyof typeof messages.en

export interface TranslationParameters {
  maskedDomainGroup: { number: number }
  numberedWindow: { number: number }
  closeGroupConfirm: { count: number }
  tabCount: { count: number }
  activateMaskedTab: { current: string }
  closeDomainGroup: { label: string; count: number }
}

type ParameterizedTranslationKey = keyof TranslationParameters
export type PlainTranslationKey = Exclude<
  TranslationKey,
  ParameterizedTranslationKey
>
type RuntimeTranslationValues = Readonly<Record<string, string | number>>

export interface Translator {
  <K extends PlainTranslationKey>(key: K): string
  <K extends ParameterizedTranslationKey>(
    key: K,
    values: TranslationParameters[K],
  ): string
}

export function resolveLocale(
  preference: UiLanguagePreference,
  browserLanguages: readonly string[],
): SupportedLocale {
  if (preference !== 'auto') return preference
  for (const language of browserLanguages) {
    const normalized = language.toLowerCase()
    if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN'
    if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  }
  return 'en'
}

function requireInterpolationValue(
  values: RuntimeTranslationValues,
  name: string,
  key: TranslationKey,
): string | number {
  if (!Object.prototype.hasOwnProperty.call(values, name)) {
    throw new Error(`Missing interpolation value "${name}" for translation "${key}".`)
  }
  return values[name]
}

function interpolate(
  template: string,
  values: RuntimeTranslationValues,
  key: TranslationKey,
): string {
  let result = template.replace(
    /\{(\w+), plural, one \{([^{}]+)\} other \{([^{}]+)\}\}/g,
    (_match, name: string, singular: string, plural: string) =>
      Number(requireInterpolationValue(values, name, key)) === 1
        ? singular
        : plural,
  )
  result = result.replace(/\{(\w+)\}/g, (_match, name: string) =>
    String(requireInterpolationValue(values, name, key)),
  )
  return result
}

export function createTranslator(locale: SupportedLocale): Translator {
  const translate = (
    key: TranslationKey,
    values: RuntimeTranslationValues = {},
  ): string => interpolate(messages[locale][key], values, key)

  return translate as Translator
}
