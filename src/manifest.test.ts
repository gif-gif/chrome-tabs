// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface ExtensionManifest {
  manifest_version: number
  minimum_chrome_version: string
  permissions: string[]
  host_permissions?: string[]
  content_security_policy: {
    extension_pages: string
  }
  side_panel: {
    default_path: string
  }
  background: {
    service_worker: string
  }
  action: {
    default_title: string
    default_icon: Record<string, string>
  }
  icons: Record<string, string>
}

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const manifestPath = resolve(publicDir, 'manifest.json')
const backgroundPath = resolve(publicDir, 'background.js')

const readManifest = () =>
  JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest

const executeBackground = (
  setPanelBehavior = vi.fn(() => Promise.resolve()),
) => {
  const onInstalledListeners: Array<() => void> = []
  const onStartupListeners: Array<() => void> = []
  const consoleError = vi.fn()
  const chromeMock = {
    sidePanel: { setPanelBehavior },
    runtime: {
      onInstalled: {
        addListener: vi.fn((listener: () => void) => {
          onInstalledListeners.push(listener)
        }),
      },
      onStartup: {
        addListener: vi.fn((listener: () => void) => {
          onStartupListeners.push(listener)
        }),
      },
    },
  }

  const backgroundSource = readFileSync(backgroundPath, 'utf8')
  const runBackground = new Function('chrome', 'console', backgroundSource)
  runBackground(chromeMock, { error: consoleError })

  return {
    chromeMock,
    consoleError,
    onInstalledListeners,
    onStartupListeners,
    setPanelBehavior,
  }
}

describe('Manifest V3 side panel wiring', () => {
  it('declares the supported Chrome version and side panel configuration', () => {
    expect(existsSync(manifestPath), 'public/manifest.json should exist').toBe(
      true,
    )

    const manifest = readManifest()

    expect(manifest.manifest_version).toBe(3)
    expect(manifest.minimum_chrome_version).toBe('141')
    expect(manifest.permissions).toEqual(['tabs', 'favicon', 'sidePanel'])
    expect(manifest.host_permissions ?? []).toEqual([])
    expect(manifest.side_panel.default_path).toBe('index.html')
    expect(manifest.background.service_worker).toBe('background.js')
  })


  it('uses the local favicon permission without broad host access', () => {
    const manifest = readManifest()

    expect(manifest.permissions).toContain('favicon')
    expect(manifest.host_permissions ?? []).toEqual([])
  })

  it('blocks remote extension-page resources, including http(s) images', () => {
    const { extension_pages: policy } = readManifest().content_security_policy

    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("img-src 'self' data:")
    expect(policy).not.toMatch(/img-src[^;]*https?:/)
    expect(policy).not.toMatch(/img-src[^;]*\*/)
    expect(policy).toContain("object-src 'none'")
  })

  it('maps action and extension icons to existing public assets', () => {
    const manifest = readManifest()
    const expectedIcons = {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    }

    expect(manifest.action.default_title).toBeTruthy()
    expect(manifest.action.default_icon).toEqual(expectedIcons)
    expect(manifest.icons).toEqual(expectedIcons)

    for (const iconPath of new Set([
      ...Object.values(manifest.action.default_icon),
      ...Object.values(manifest.icons),
    ])) {
      expect(
        existsSync(resolve(publicDir, iconPath)),
        `public/${iconPath} should exist`,
      ).toBe(true)
    }
  })

  it('configures action clicks on installation and browser startup', () => {
    expect(existsSync(backgroundPath), 'public/background.js should exist').toBe(
      true,
    )

    const harness = executeBackground()

    expect(harness.chromeMock.runtime.onInstalled.addListener).toHaveBeenCalledOnce()
    expect(harness.chromeMock.runtime.onStartup.addListener).toHaveBeenCalledOnce()
    expect(harness.onInstalledListeners).toHaveLength(1)
    expect(harness.onStartupListeners).toHaveLength(1)

    harness.onInstalledListeners[0]()
    harness.onStartupListeners[0]()

    expect(harness.setPanelBehavior).toHaveBeenCalledTimes(2)
    expect(harness.setPanelBehavior).toHaveBeenNthCalledWith(1, {
      openPanelOnActionClick: true,
    })
    expect(harness.setPanelBehavior).toHaveBeenNthCalledWith(2, {
      openPanelOnActionClick: true,
    })
  })

  it('reports failures while configuring side panel behavior', async () => {
    const error = new Error('side panel unavailable')
    const harness = executeBackground(vi.fn(() => Promise.reject(error)))

    harness.onInstalledListeners[0]()
    await Promise.resolve()
    await Promise.resolve()

    expect(harness.consoleError).toHaveBeenCalledWith(error)
  })
})

describe('localized extension metadata', () => {
  it('uses Chrome message placeholders and matching non-empty English and Chinese resources', () => {
    const manifest = readManifest() as ExtensionManifest & {
      default_locale?: string
      name?: string
      description?: string
    }
    expect(manifest.default_locale).toBe('en')
    expect(manifest.name).toBe('__MSG_extensionName__')
    expect(manifest.description).toBe('__MSG_extensionDescription__')
    expect(manifest.action.default_title).toBe('__MSG_actionTitle__')

    const englishPath = resolve(publicDir, '_locales/en/messages.json')
    const chinesePath = resolve(publicDir, '_locales/zh_CN/messages.json')
    expect(existsSync(englishPath)).toBe(true)
    expect(existsSync(chinesePath)).toBe(true)

    const english = JSON.parse(readFileSync(englishPath, 'utf8')) as Record<
      string,
      { message?: string }
    >
    const chinese = JSON.parse(readFileSync(chinesePath, 'utf8')) as Record<
      string,
      { message?: string }
    >
    expect(Object.keys(english).sort()).toEqual(Object.keys(chinese).sort())
    expect(Object.keys(english).sort()).toEqual([
      'actionTitle',
      'extensionDescription',
      'extensionName',
    ])
    for (const messages of [english, chinese]) {
      for (const entry of Object.values(messages)) {
        expect(entry.message?.trim()).toBeTruthy()
      }
    }
  })
})
