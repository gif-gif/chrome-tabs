export type SupportedLocale = 'zh-CN' | 'zh-TW' | 'en'
export type UiLanguagePreference = 'auto' | SupportedLocale

export const messages = {
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
    copyLinkError: '无法复制链接，请重试。',
    markdownUnsupportedTip: '此页面不支持复制为 Markdown',
    markdownFileAccessError: '要复制本地文件，请在扩展详情页开启“允许访问文件网址”。',
    markdownPermissionError: '需要允许访问网站内容才能复制为 Markdown。',
    markdownUnloadedError: '这个标签页还没加载，请先打开它再复制。',
    markdownEmptyError: '这个页面没有可复制的文字内容。',
    markdownError: '无法复制为 Markdown，请重试。',
    closeGroupError: '无法关闭该分组，请重试。',
    closeGroupConfirm: '关闭该分组中的 {count} 个标签？',
    removeDuplicatesConfirm: '关闭该分组中的 {count} 个重复标签？',
    removeDuplicatesError: '无法移除重复标签页，请重试。',
    sortTabsError: '无法按域名排序标签页，请重试。',
    restoreTabOrderError: '无法恢复标签页原始顺序，请重试。',
    toolbar: '标签页工具栏',
    expandAllGroups: '全部展开分组',
    collapseAllGroups: '全部折叠分组',
    locateCurrentTab: '定位当前标签',
    expand: '展开',
    collapse: '折叠',
    viewMode: '标签页显示模式',
    listView: '列表视图',
    domainView: '域名分组视图',
    customView: '自定义分组视图',
    ungroupedTabs: '未分组',
    newCustomGroupName: '新分组名称',
    newCustomGroupPlaceholder: '新建分组，例如：工作',
    createCustomGroup: '新建分组',
    customGroupName: '分组名称',
    saveCustomGroupName: '保存分组名称',
    cancel: '取消',
    chooseGroupTabsHint: '勾选要放进这个分组的标签页',
    noTabsToChoose: '当前没有可选的标签页',
    savedTabNotOpen: '未打开',
    customGroupEmpty: '这个分组还没有标签页，点击勾选按钮添加。',
    customGroupNoOpenTabs: '这个分组里的标签页当前都没有打开或不符合筛选条件。',
    customGroupHiddenByFilter: '另有 {count} 个已选标签被当前搜索或筛选隐藏',
    noCustomGroups: '还没有自定义分组',
    noCustomGroupsHint: '在上方输入名称新建一个分组，再勾选要放进去的标签页。',
    list: '列表',
    group: '分组',
    showAllInformation: '显示全部标签信息',
    hideAllInformation: '隐藏全部标签信息',
    tabCount: '{count} 个标签',
    currentTab: '当前标签',
    currentTabSuffix: '，当前标签',
    activateMaskedTab: '切换到隐藏的标签页{current}',
    showTabInformation: '显示此标签信息',
    hideTabInformation: '隐藏此标签信息',
    copyTabLink: '复制标签链接',
    copyTabMarkdown: '复制为 Markdown',
    addTabToFavorites: '收藏标签',
    removeTabFromFavorites: '取消收藏标签',
    pinTab: '置顶标签',
    unpinTab: '取消置顶标签',
    pinGroup: '置顶分组',
    unpinGroup: '取消置顶分组',
    closeTab: '关闭标签页',
    showGroupInformation: '显示此分组信息',
    hideGroupInformation: '隐藏此分组信息',
    closeDomainGroup: '关闭 {label} 分组中的 {count} 个标签',
    chooseGroupTabs: '选择 {label} 分组的标签页',
    renameCustomGroup: '重命名 {label} 分组',
    deleteCustomGroup: '删除 {label} 分组',
    dragCustomGroup: '拖动调整 {label} 分组的顺序，也可以用上下方向键',
    finishChoosingGroupTabs: '完成选择 {label} 分组的标签页',
    deleteCustomGroupConfirm: '删除“{label}”分组？分组里的标签页不会被关闭。',
    removeDuplicateTabs: '移除 {count} 个重复标签',
    noDuplicateTabs: '没有重复标签页',
    loading: '正在加载标签页…',
    emptyTitle: '没有找到匹配的标签页',
    emptyHint: '请尝试清除搜索词或调整筛选条件。',
    retry: '重试',
    all: '全部',
    allTabs: '全部标签页',
    allShort: '全部',
    currentWindowFilter: '当前窗口',
    currentWindowShort: '当前',
    favoriteTabs: '收藏标签',
    favoritesShort: '收藏',
    sortTabsByDomainAscending: '按域名升序排列标签页',
    sortingTabsByDomainAscending: '正在按域名升序排列标签页',
    sortTabsByDomainDescending: '按域名降序排列标签页',
    sortingTabsByDomainDescending: '正在按域名降序排列标签页',
    restoreOriginalTabOrder: '恢复标签页原始顺序',
    restoringOriginalTabOrder: '正在恢复标签页原始顺序',
    searchAndFilter: '搜索和筛选',
    searchAndView: '搜索和显示模式',
    searchTabs: '搜索标签页',
    searchPlaceholder: '搜索标题或网址…',
    clearSearch: '清除搜索',
    tabFilters: '标签页筛选',
    displayLanguage: '显示语言',
    autoLanguage: '自动（浏览器语言）',
    colorScheme: '外观',
    colorSchemeAuto: '自动（跟随系统）',
    colorSchemeLight: '浅色',
    colorSchemeDark: '暗色',
    simplifiedChineseLanguage: '简体中文',
    traditionalChineseLanguage: '繁體中文',
    englishLanguage: 'English',
  },
  'zh-TW': {
    informationHidden: '內容已隱藏',
    maskedDomainGroup: '網站群組 {number}',
    otherPages: '其他頁面',
    currentWindow: '目前視窗',
    numberedWindow: '視窗 {number}',
    queryError: '無法載入分頁，請重試。',
    subscriptionError: '即時同步暫時無法使用，請重試。',
    activateError: '無法切換到該分頁，請重試。',
    closeTabError: '無法關閉該分頁，請重試。',
    copyLinkError: '無法複製連結，請重試。',
    markdownUnsupportedTip: '此頁面不支援複製為 Markdown',
    markdownFileAccessError: '要複製本機檔案，請在擴充功能詳細資料頁開啟「允許存取檔案網址」。',
    markdownPermissionError: '需要允許存取網站內容才能複製為 Markdown。',
    markdownUnloadedError: '這個分頁尚未載入，請先開啟再複製。',
    markdownEmptyError: '這個頁面沒有可複製的文字內容。',
    markdownError: '無法複製為 Markdown，請重試。',
    closeGroupError: '無法關閉該群組，請重試。',
    closeGroupConfirm: '關閉該群組中的 {count} 個分頁？',
    removeDuplicatesConfirm: '關閉該群組中的 {count} 個重複分頁？',
    removeDuplicatesError: '無法移除重複分頁，請重試。',
    sortTabsError: '無法依網域排序分頁，請重試。',
    restoreTabOrderError: '無法還原分頁原始順序，請重試。',
    toolbar: '分頁工具列',
    expandAllGroups: '全部展開群組',
    collapseAllGroups: '全部收合群組',
    locateCurrentTab: '定位目前分頁',
    expand: '展開',
    collapse: '收合',
    viewMode: '分頁顯示模式',
    listView: '清單檢視',
    domainView: '網域分組檢視',
    customView: '自訂群組檢視',
    ungroupedTabs: '未分組',
    newCustomGroupName: '新群組名稱',
    newCustomGroupPlaceholder: '新增群組，例如：工作',
    createCustomGroup: '新增群組',
    customGroupName: '群組名稱',
    saveCustomGroupName: '儲存群組名稱',
    cancel: '取消',
    chooseGroupTabsHint: '勾選要放進這個群組的分頁',
    noTabsToChoose: '目前沒有可選的分頁',
    savedTabNotOpen: '未開啟',
    customGroupEmpty: '這個群組還沒有分頁，點選勾選按鈕新增。',
    customGroupNoOpenTabs: '這個群組裡的分頁目前都沒有開啟或不符合篩選條件。',
    customGroupHiddenByFilter: '另有 {count} 個已選分頁被目前的搜尋或篩選隱藏',
    noCustomGroups: '還沒有自訂群組',
    noCustomGroupsHint: '在上方輸入名稱新增一個群組，再勾選要放進去的分頁。',
    list: '清單',
    group: '分組',
    showAllInformation: '顯示全部分頁資訊',
    hideAllInformation: '隱藏全部分頁資訊',
    tabCount: '{count} 個分頁',
    currentTab: '目前分頁',
    currentTabSuffix: '，目前分頁',
    activateMaskedTab: '切換到隱藏的分頁{current}',
    showTabInformation: '顯示此分頁資訊',
    hideTabInformation: '隱藏此分頁資訊',
    copyTabLink: '複製分頁連結',
    copyTabMarkdown: '複製為 Markdown',
    addTabToFavorites: '收藏分頁',
    removeTabFromFavorites: '取消收藏分頁',
    pinTab: '置頂分頁',
    unpinTab: '取消置頂分頁',
    pinGroup: '置頂群組',
    unpinGroup: '取消置頂群組',
    closeTab: '關閉分頁',
    showGroupInformation: '顯示此群組資訊',
    hideGroupInformation: '隱藏此群組資訊',
    closeDomainGroup: '關閉 {label} 群組中的 {count} 個分頁',
    chooseGroupTabs: '選擇 {label} 群組的分頁',
    renameCustomGroup: '重新命名 {label} 群組',
    deleteCustomGroup: '刪除 {label} 群組',
    dragCustomGroup: '拖曳調整 {label} 群組的順序，也可以使用上下方向鍵',
    finishChoosingGroupTabs: '完成選擇 {label} 群組的分頁',
    deleteCustomGroupConfirm: '刪除「{label}」群組？群組裡的分頁不會被關閉。',
    removeDuplicateTabs: '移除 {count} 個重複分頁',
    noDuplicateTabs: '沒有重複分頁',
    loading: '正在載入分頁…',
    emptyTitle: '找不到符合的分頁',
    emptyHint: '請嘗試清除搜尋字詞或調整篩選條件。',
    retry: '重試',
    all: '全部',
    allTabs: '全部分頁',
    allShort: '全部',
    currentWindowFilter: '目前視窗',
    currentWindowShort: '目前',
    favoriteTabs: '收藏分頁',
    favoritesShort: '收藏',
    sortTabsByDomainAscending: '依網域遞增排列分頁',
    sortingTabsByDomainAscending: '正在依網域遞增排列分頁',
    sortTabsByDomainDescending: '依網域遞減排列分頁',
    sortingTabsByDomainDescending: '正在依網域遞減排列分頁',
    restoreOriginalTabOrder: '還原分頁原始順序',
    restoringOriginalTabOrder: '正在還原分頁原始順序',
    searchAndFilter: '搜尋和篩選',
    searchAndView: '搜尋和顯示模式',
    searchTabs: '搜尋分頁',
    searchPlaceholder: '搜尋標題或網址…',
    clearSearch: '清除搜尋',
    tabFilters: '分頁篩選',
    displayLanguage: '顯示語言',
    autoLanguage: '自動（瀏覽器語言）',
    colorScheme: '外觀',
    colorSchemeAuto: '自動（跟隨系統）',
    colorSchemeLight: '淺色',
    colorSchemeDark: '深色',
    simplifiedChineseLanguage: '简体中文',
    traditionalChineseLanguage: '繁體中文',
    englishLanguage: 'English',
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
    copyLinkError: 'Unable to copy the link. Please try again.',
    markdownUnsupportedTip: 'This page can\'t be copied as Markdown',
    markdownFileAccessError: 'To copy local files, turn on "Allow access to file URLs" on the extension details page.',
    markdownPermissionError: 'Site access is needed to copy pages as Markdown.',
    markdownUnloadedError: 'This tab is not loaded yet. Open it first, then copy.',
    markdownEmptyError: 'This page has no text to copy.',
    markdownError: 'Unable to copy as Markdown. Please try again.',
    closeGroupError: 'Unable to close this group. Please try again.',
    closeGroupConfirm: 'Close {count} {count, plural, one {tab} other {tabs}} in this group?',
    removeDuplicatesConfirm: 'Close {count} duplicate {count, plural, one {tab} other {tabs}} in this group?',
    removeDuplicatesError: 'Unable to remove duplicate tabs. Please try again.',
    sortTabsError: 'Unable to sort tabs by domain. Please try again.',
    restoreTabOrderError: 'Unable to restore the original tab order. Please try again.',
    toolbar: 'Tab toolbar',
    expandAllGroups: 'Expand all groups',
    collapseAllGroups: 'Collapse all groups',
    locateCurrentTab: 'Locate current tab',
    expand: 'Expand',
    collapse: 'Collapse',
    viewMode: 'Tab display mode',
    listView: 'List view',
    domainView: 'Group by domain view',
    customView: 'Custom groups view',
    ungroupedTabs: 'Ungrouped',
    newCustomGroupName: 'New group name',
    newCustomGroupPlaceholder: 'New group, e.g. Work',
    createCustomGroup: 'Create group',
    customGroupName: 'Group name',
    saveCustomGroupName: 'Save group name',
    cancel: 'Cancel',
    chooseGroupTabsHint: 'Check the tabs to include in this group',
    noTabsToChoose: 'No tabs to choose from',
    savedTabNotOpen: 'Not open',
    customGroupEmpty: 'This group has no tabs yet. Use the checklist button to add some.',
    customGroupNoOpenTabs: 'None of the tabs in this group are open or match the current filter.',
    customGroupHiddenByFilter: '{count} more selected {count, plural, one {tab is} other {tabs are}} hidden by the current search or filter',
    noCustomGroups: 'No custom groups yet',
    noCustomGroupsHint: 'Enter a name above to create a group, then check the tabs to include.',
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
    copyTabLink: 'Copy tab link',
    copyTabMarkdown: 'Copy as Markdown',
    addTabToFavorites: 'Add tab to favorites',
    removeTabFromFavorites: 'Remove tab from favorites',
    pinTab: 'Pin tab',
    unpinTab: 'Unpin tab',
    pinGroup: 'Pin group',
    unpinGroup: 'Unpin group',
    closeTab: 'Close tab',
    showGroupInformation: 'Show this group information',
    hideGroupInformation: 'Hide this group information',
    closeDomainGroup: 'Close {count} {count, plural, one {tab} other {tabs}} in {label} group',
    chooseGroupTabs: 'Choose tabs for {label} group',
    renameCustomGroup: 'Rename {label} group',
    deleteCustomGroup: 'Delete {label} group',
    dragCustomGroup: 'Drag to reorder the {label} group, or use the up and down arrow keys',
    finishChoosingGroupTabs: 'Finish choosing tabs for {label} group',
    deleteCustomGroupConfirm: 'Delete the "{label}" group? Its tabs will not be closed.',
    removeDuplicateTabs: 'Remove {count} duplicate {count, plural, one {tab} other {tabs}}',
    noDuplicateTabs: 'No duplicate tabs',
    loading: 'Loading tabs…',
    emptyTitle: 'No matching tabs found',
    emptyHint: 'Try clearing the search or changing the filters.',
    retry: 'Retry',
    all: 'All',
    allTabs: 'All tabs',
    allShort: 'All',
    currentWindowFilter: 'Current window',
    currentWindowShort: 'Current',
    favoriteTabs: 'Favorite tabs',
    favoritesShort: 'Saved',
    sortTabsByDomainAscending: 'Sort tabs by domain ascending',
    sortingTabsByDomainAscending: 'Sorting tabs by domain ascending',
    sortTabsByDomainDescending: 'Sort tabs by domain descending',
    sortingTabsByDomainDescending: 'Sorting tabs by domain descending',
    restoreOriginalTabOrder: 'Restore original tab order',
    restoringOriginalTabOrder: 'Restoring original tab order',
    searchAndFilter: 'Search and filters',
    searchAndView: 'Search and view mode',
    searchTabs: 'Search tabs',
    searchPlaceholder: 'Search titles or URLs…',
    clearSearch: 'Clear search',
    tabFilters: 'Tab filters',
    displayLanguage: 'Display language',
    autoLanguage: 'Auto (browser language)',
    colorScheme: 'Appearance',
    colorSchemeAuto: 'Auto (system)',
    colorSchemeLight: 'Light',
    colorSchemeDark: 'Dark',
    simplifiedChineseLanguage: '简体中文',
    traditionalChineseLanguage: '繁體中文',
    englishLanguage: 'English',
  },
} as const

export type TranslationKey = keyof typeof messages.en

export interface TranslationParameters {
  maskedDomainGroup: { number: number }
  numberedWindow: { number: number }
  closeGroupConfirm: { count: number }
  removeDuplicatesConfirm: { count: number }
  removeDuplicateTabs: { count: number }
  tabCount: { count: number }
  activateMaskedTab: { current: string }
  closeDomainGroup: { label: string; count: number }
  chooseGroupTabs: { label: string }
  renameCustomGroup: { label: string }
  deleteCustomGroup: { label: string }
  dragCustomGroup: { label: string }
  customGroupHiddenByFilter: { count: number }
  finishChoosingGroupTabs: { label: string }
  deleteCustomGroupConfirm: { label: string }
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

const traditionalChineseSubtags = new Set(['hant', 'tw', 'hk', 'mo'])

function isTraditionalChinese(normalizedLanguage: string): boolean {
  const subtags = normalizedLanguage.split('-').slice(1)
  if (subtags.includes('hans')) return false
  return subtags.some((subtag) => traditionalChineseSubtags.has(subtag))
}

export function resolveLocale(
  preference: UiLanguagePreference,
  browserLanguages: readonly string[],
): SupportedLocale {
  if (preference !== 'auto') return preference
  for (const language of browserLanguages) {
    const normalized = language.toLowerCase()
    if (normalized === 'zh' || normalized.startsWith('zh-')) {
      return isTraditionalChinese(normalized) ? 'zh-TW' : 'zh-CN'
    }
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
