import { describe, expect, it } from 'vitest'
import { createTranslator, resolveLocale, type Translator } from './i18n'



function assertTranslatorTypeContract(t: Translator) {
  t('toolbar')
  t('allTabs')
  t('allShort')
  t('currentWindowShort')
  t('activeTabsShort')
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
  it.each(['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-Hans', 'ZH-cn'])(
    'maps %s to Simplified Chinese in auto mode',
    (language) => {
      expect(resolveLocale('auto', [language])).toBe('zh-CN')
    },
  )

  it.each(['en', 'en-US', 'en-GB', 'EN-us'])(
    'maps %s to English in auto mode',
    (language) => {
      expect(resolveLocale('auto', [language])).toBe('en')
    },
  )

  it('uses the first supported browser language and skips unsupported entries', () => {
    expect(resolveLocale('auto', ['fr-FR', 'zh-TW', 'en-US'])).toBe('zh-CN')
    expect(resolveLocale('auto', ['de', 'en-GB', 'zh-CN'])).toBe('en')
  })

  it('falls back to English for empty or unsupported browser language lists', () => {
    expect(resolveLocale('auto', [])).toBe('en')
    expect(resolveLocale('auto', ['fr-FR', 'de-DE'])).toBe('en')
  })

  it('lets a manual preference override browser languages', () => {
    expect(resolveLocale('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(resolveLocale('en', ['zh-CN'])).toBe('en')
  })
})

describe('createTranslator', () => {
  it('translates static copy and interpolates variables', () => {
    const zh = createTranslator('zh-CN')
    const en = createTranslator('en')

    expect(zh('currentWindow')).toBe('当前窗口')
    expect(en('currentWindow')).toBe('Current window')
    expect(zh('allTabs')).toBe('全部标签页')
    expect(zh('allShort')).toBe('全部')
    expect(zh('currentWindowShort')).toBe('当前')
    expect(zh('activeTabsShort')).toBe('活动')
    expect(en('allTabs')).toBe('All tabs')
    expect(en('allShort')).toBe('All')
    expect(en('currentWindowShort')).toBe('Current')
    expect(en('activeTabsShort')).toBe('Active')
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
    expect(zh('tabCount', { count: 2 })).toBe('2 个标签页')
    expect(zh('maskedDomainGroup', { number: 4 })).toBe('网站分组 4')
    expect(zh('closeDomainGroup', { label: 'google.com', count: 2 })).toBe(
      '关闭 google.com 分组中的 2 个标签页',
    )
  })
})
