import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateOutputDirectory } from './escapeUrlProtocols'

const REQUIRED_LOCALES = ['en', 'zh_CN'] as const
const MESSAGE_REFERENCE_PATTERN = /^__MSG_([A-Za-z0-9_@]+)__$/

interface LocaleMessage {
  message?: unknown
}

type LocaleMessages = Record<string, LocaleMessage>

async function readJsonFile(filePath: string): Promise<unknown> {
  let source: string
  try {
    source = await readFile(filePath, 'utf8')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Required build file is missing or unreadable: ${filePath}. ${detail}`)
  }

  try {
    return JSON.parse(source) as unknown
  } catch {
    throw new Error(`Build file contains invalid JSON: ${filePath}.`)
  }
}

function requireRecord(value: unknown, filePath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${filePath}.`)
  }
  return value as Record<string, unknown>
}

function collectManifestMessageKeys(value: unknown, keys: Set<string>): void {
  if (typeof value === 'string') {
    const match = MESSAGE_REFERENCE_PATTERN.exec(value)
    if (match) keys.add(match[1])
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectManifestMessageKeys(item, keys))
    return
  }
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((item) => collectManifestMessageKeys(item, keys))
  }
}

function validateLocaleMessages(
  value: unknown,
  filePath: string,
): LocaleMessages {
  const messages = requireRecord(value, filePath) as LocaleMessages
  for (const [key, entry] of Object.entries(messages)) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.message !== 'string' ||
      entry.message.trim() === ''
    ) {
      throw new Error(`Locale message "${key}" is empty or invalid in ${filePath}.`)
    }
  }
  return messages
}

function assertMatchingLocaleKeys(
  enMessages: LocaleMessages,
  zhCnMessages: LocaleMessages,
): void {
  const enKeys = Object.keys(enMessages).sort()
  const zhCnKeys = Object.keys(zhCnMessages).sort()
  if (
    enKeys.length !== zhCnKeys.length ||
    enKeys.some((key, index) => key !== zhCnKeys[index])
  ) {
    throw new Error('Locale keys must match exactly between en and zh_CN.')
  }
}

export async function validateLocaleResources(directory: string): Promise<void> {
  const manifestPath = resolve(directory, 'manifest.json')
  const manifest = requireRecord(await readJsonFile(manifestPath), manifestPath)
  if (manifest.default_locale !== 'en') {
    throw new Error('Final manifest default_locale must be "en".')
  }

  const localeMessages = new Map<string, LocaleMessages>()
  for (const locale of REQUIRED_LOCALES) {
    const filePath = resolve(directory, '_locales', locale, 'messages.json')
    localeMessages.set(
      locale,
      validateLocaleMessages(await readJsonFile(filePath), filePath),
    )
  }

  const enMessages = localeMessages.get('en')!
  const zhCnMessages = localeMessages.get('zh_CN')!
  assertMatchingLocaleKeys(enMessages, zhCnMessages)

  const referencedKeys = new Set<string>()
  collectManifestMessageKeys(manifest, referencedKeys)
  for (const key of referencedKeys) {
    if (!Object.prototype.hasOwnProperty.call(enMessages, key)) {
      throw new Error(
        `Manifest references missing default locale message key "${key}".`,
      )
    }
  }
}

export async function validateFinalDist(directory = 'dist'): Promise<void> {
  const resolvedDirectory = resolve(directory)
  await validateOutputDirectory(resolvedDirectory)
  await validateLocaleResources(resolvedDirectory)
}

async function main(): Promise<void> {
  const directory = process.argv[2] ?? 'dist'
  await validateFinalDist(directory)
  console.log(`Validated final build output: ${resolve(directory)}`)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
