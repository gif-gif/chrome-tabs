import { describe, expect, it } from 'vitest'
import {
  createTranslator,
  messages,
  resolveLocale,
  type SupportedLocale,
  type TranslationKey,
  type Translator,
} from './i18n'



function assertTranslatorTypeContract(t: Translator) {
  t('toolbar')
  t('currentWindowShort')
  t('sortTabsByDomainAscending')
  t('sortTabsByDomainDescending')
  t('restoreOriginalTabOrder')
  t('chooseGroupTabs', { label: 'Work' })
  // @ts-expect-error Custom group labels must be supplied.
  t('deleteCustomGroupConfirm')
  t('removeDuplicateTabs', { count: 2 })
  t('tabCount', { count: 2 })
  t('closeDomainGroup', { label: 'example.com', count: 2 })

  // @ts-expect-error Static translations do not accept interpolation values.
  t('toolbar', { count: 2 })
  // @ts-expect-error Parameterized translations require their values.
  t('tabCount')
  // @ts-expect-error All required interpolation values must be supplied.
  t('closeDomainGroup', { count: 2 })
  // @ts-expect-error Interpolation value types are key-specific.
  t('numberedWindow', { number: '2' })
}
void assertTranslatorTypeContract

describe('resolveLocale', () => {
  it.each(['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-HK', 'ZH-cn'])(
    'maps %s to Simplified Chinese in auto mode',
    (language) => {
      expect(resolveLocale('auto', [language])).toBe('zh-CN')
    },
  )

  it.each(['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'ZH-tw'])(
    'maps %s to Traditional Chinese in auto mode',
    (language) => {
      expect(resolveLocale('auto', [language])).toBe('zh-TW')
    },
  )

  it.each(['en', 'en-US', 'en-GB', 'EN-us'])(
    'maps %s to English in auto mode',
    (language) => {
      expect(resolveLocale('auto', [language])).toBe('en')
    },
  )

  it('uses the first supported browser language and skips unsupported entries', () => {
    expect(resolveLocale('auto', ['fr-FR', 'zh-TW', 'en-US'])).toBe('zh-TW')
    expect(resolveLocale('auto', ['fr-FR', 'zh-CN', 'zh-TW'])).toBe('zh-CN')
    expect(resolveLocale('auto', ['de', 'en-GB', 'zh-CN'])).toBe('en')
  })

  it('falls back to English for empty or unsupported browser language lists', () => {
    expect(resolveLocale('auto', [])).toBe('en')
    expect(resolveLocale('auto', ['fr-FR', 'de-DE'])).toBe('en')
  })

  it('lets a manual preference override browser languages', () => {
    expect(resolveLocale('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(resolveLocale('en', ['zh-CN'])).toBe('en')
    expect(resolveLocale('zh-TW', ['zh-CN'])).toBe('zh-TW')
    expect(resolveLocale('zh-CN', ['zh-TW'])).toBe('zh-CN')
  })
})

describe('createTranslator', () => {
  const locales: SupportedLocale[] = ['zh-CN', 'zh-TW', 'en']
  const translationKeys = Object.keys(
    messages.en,
  ) as TranslationKey[]

  it.each(locales)('defines every translation key with non-empty text for %s', (locale) => {
    const localeMessages = messages[locale]
    expect(Object.keys(localeMessages).sort()).toEqual([...translationKeys].sort())
    for (const key of translationKeys) {
      expect(localeMessages[key].trim(), `${locale}.${key}`).not.toBe('')
    }
  })

  it.each(locales.filter((locale) => locale !== 'en'))(
    'keeps the same interpolation placeholders as English for %s',
    (locale) => {
      const placeholders = (template: string) =>
        [...template.matchAll(/(?<!(?:one|other) )\{(\w+)[,}]/g)].map((match) => match[1]).sort()
      const localeMessages = messages[locale]
      for (const key of translationKeys) {
        expect(
          [...new Set(placeholders(localeMessages[key]))],
          `${locale}.${key}`,
        ).toEqual([...new Set(placeholders(messages.en[key]))])
      }
    },
  )

  it('labels each language by its own name in every interface language', () => {
    for (const locale of locales) {
      const t = createTranslator(locale)
      expect(t('simplifiedChineseLanguage')).toBe('简体中文')
      expect(t('traditionalChineseLanguage')).toBe('繁體中文')
      expect(t('englishLanguage')).toBe('English')
    }
  })

  it('translates Traditional Chinese copy with interpolation', () => {
    const zhTw = createTranslator('zh-TW')
    expect(zhTw('toolbar')).toBe('分頁工具列')
    expect(zhTw('displayLanguage')).toBe('顯示語言')
    expect(zhTw('tabCount', { count: 2 })).toBe('2 個分頁')
    expect(zhTw('closeDomainGroup', { label: 'google.com', count: 2 })).toBe(
      '關閉 google.com 群組中的 2 個分頁',
    )
    expect(zhTw('deleteCustomGroupConfirm', { label: '工作' })).toBe(
      '刪除「工作」群組？群組裡的分頁不會被關閉。',
    )
  })

  it('translates static copy and interpolates variables', () => {
    const zh = createTranslator('zh-CN')
    const en = createTranslator('en')

    expect(zh('currentWindow')).toBe('当前窗口')
    expect(en('currentWindow')).toBe('Current window')
    expect(zh('currentWindowShort')).toBe('当前')
    expect(en('currentWindowShort')).toBe('Current')
    expect(zh('sortTabsByDomainAscending')).toBe('按域名升序排列标签页')
    expect(zh('sortTabsByDomainDescending')).toBe('按域名降序排列标签页')
    expect(en('sortTabsByDomainAscending')).toBe('Sort tabs by domain ascending')
    expect(en('sortTabsByDomainDescending')).toBe('Sort tabs by domain descending')
    expect(zh('restoreOriginalTabOrder')).toBe('恢复标签页原始顺序')
    expect(zh('customView')).toBe('自定义分组视图')
    expect(zh('markdownUnsupportedTip')).toBe('此页面不支持复制为 Markdown')
    expect(en('markdownUnsupportedTip')).toBe("This page can't be copied as Markdown")
    expect(en('dragCustomGroup', { label: 'Work' })).toBe('Drag to reorder the Work group, or use the up and down arrow keys')
    expect(en('customGroupHiddenByFilter', { count: 1 })).toBe('1 more selected tab is hidden by the current search or filter')
    expect(en('customView')).toBe('Custom groups view')
    expect(en('deleteCustomGroupConfirm', { label: 'Work' })).toBe('Delete the "Work" group? Its tabs will not be closed.')
    expect(en('restoreOriginalTabOrder')).toBe('Restore original tab order')
    expect(zh('restoreTabOrderError')).toBe('无法恢复标签页原始顺序，请重试。')
    expect(en('restoreTabOrderError')).toBe('Unable to restore the original tab order. Please try again.')
    expect(zh('noDuplicateTabs')).toBe('没有重复标签页')
    expect(en('noDuplicateTabs')).toBe('No duplicate tabs')
    expect(zh('copyTabLink')).toBe('复制标签链接')
    expect(zh('copyLinkError')).toBe('无法复制链接，请重试。')
    expect(en('copyTabLink')).toBe('Copy tab link')
    expect(en('copyLinkError')).toBe('Unable to copy the link. Please try again.')
    expect(zh('pinTab')).toBe('置顶标签')
    expect(zh('unpinTab')).toBe('取消置顶标签')
    expect(zh('pinGroup')).toBe('置顶分组')
    expect(zh('unpinGroup')).toBe('取消置顶分组')
    expect(en('pinTab')).toBe('Pin tab')
    expect(en('unpinTab')).toBe('Unpin tab')
    expect(en('pinGroup')).toBe('Pin group')
    expect(en('unpinGroup')).toBe('Unpin group')
    expect(zh('colorScheme')).toBe('外观')
    expect([zh('colorSchemeAuto'), zh('colorSchemeLight'), zh('colorSchemeDark')]).toEqual(['自动（跟随系统）', '浅色', '暗色'])
    expect([en('colorSchemeAuto'), en('colorSchemeLight'), en('colorSchemeDark')]).toEqual(['Auto (system)', 'Light', 'Dark'])
    expect(zh('numberedWindow', { number: 3 })).toBe('窗口 3')
    expect(en('numberedWindow', { number: 3 })).toBe('Window 3')
  })

  it('uses grammatically correct English singular and plural tab counts', () => {
    const en = createTranslator('en')
    expect(en('tabCount', { count: 1 })).toBe('1 tab')
    expect(en('tabCount', { count: 2 })).toBe('2 tabs')
    expect(en('closeGroupConfirm', { count: 1 })).toBe(
      'Close 1 tab in this group?',
    )
    expect(en('closeGroupConfirm', { count: 2 })).toBe(
      'Close 2 tabs in this group?',
    )
    expect(en('removeDuplicateTabs', { count: 1 })).toBe(
      'Remove 1 duplicate tab',
    )
    expect(en('removeDuplicateTabs', { count: 2 })).toBe(
      'Remove 2 duplicate tabs',
    )
    expect(en('removeDuplicatesConfirm', { count: 1 })).toBe(
      'Close 1 duplicate tab in this group?',
    )
    expect(en('removeDuplicatesConfirm', { count: 2 })).toBe(
      'Close 2 duplicate tabs in this group?',
    )
  })

  it('fails explicitly when a runtime caller omits a required placeholder value', () => {
    const unsafeTranslator = createTranslator('en') as unknown as (
      key: string,
      values?: Record<string, string | number>,
    ) => string

    expect(() => unsafeTranslator('tabCount', {})).toThrow(/count/)
    expect(() => unsafeTranslator('closeDomainGroup', { count: 2 })).toThrow(
      /label/,
    )
  })

  it('keeps all interpolation values in Chinese translations', () => {
    const zh = createTranslator('zh-CN')
    expect(zh('tabCount', { count: 2 })).toBe('2 个标签')
    expect(zh('maskedDomainGroup', { number: 4 })).toBe('网站分组 4')
    expect(zh('closeDomainGroup', { label: 'google.com', count: 2 })).toBe(
      '关闭 google.com 分组中的 2 个标签',
    )
    expect(zh('removeDuplicateTabs', { count: 2 })).toBe('移除 2 个重复标签')
    expect(zh('removeDuplicatesConfirm', { count: 2 })).toBe(
      '关闭该分组中的 2 个重复标签？',
    )
  })
})
