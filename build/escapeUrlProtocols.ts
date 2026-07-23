import { parse } from 'acorn'
import * as csstree from 'css-tree'
import {
  parse as parseHtml,
  parseFragment as parseHtmlFragment,
  type DefaultTreeAdapterMap,
} from 'parse5'
import parseSrcset from 'parse-srcset'
import {
  DOMParser,
  type Document as XmlDocument,
  type DocumentType as XmlDocumentType,
  type Element as XmlElement,
  type Node as XmlNode,
} from '@xmldom/xmldom'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, posix, relative, sep } from 'node:path'
import type { OutputAsset, OutputChunk } from 'rollup'
import type { Plugin } from 'vite'

const knownReactUrlConstants = new Set([
  'https://react.dev/errors/',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
])

const textExtensions = new Set([
  '.css',
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.map',
  '.webmanifest',
  '.svg',
  '.xml',
  '.txt',
])
const allowedPngDimensions = new Map([
  ['icons/icon-16.png', 16],
  ['icons/icon-32.png', 32],
  ['icons/icon-48.png', 48],
  ['icons/icon-128.png', 128],
])
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
const literalHttpUrlPattern = /https?:\/\//g
const xmlNamespaceIdentifiers = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
])
const maxSrcdocDepth = 16
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function escapedProtocolUrl(url: string): string {
  return url.replace(':', '\\x3a')
}

interface AstNode {
  type?: string
  start?: number
  end?: number
  value?: unknown
  [key: string]: unknown
}

interface StringLiteralNode extends AstNode {
  type: 'Literal'
  value: string
  start: number
  end: number
}

function isStringLiteralNode(node: AstNode): node is StringLiteralNode {
  return (
    node.type === 'Literal' &&
    typeof node.value === 'string' &&
    typeof node.start === 'number' &&
    typeof node.end === 'number'
  )
}

function collectStringLiteralNodes(node: unknown, result: StringLiteralNode[]): void {
  if (!node || typeof node !== 'object') {
    return
  }

  const current = node as AstNode
  if (isStringLiteralNode(current)) {
    result.push(current)
  }

  for (const [key, value] of Object.entries(current)) {
    if (key === 'start' || key === 'end' || key === 'loc') {
      continue
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        collectStringLiteralNodes(child, result)
      }
    } else {
      collectStringLiteralNodes(value, result)
    }
  }
}

function parseJavaScript(source: string): AstNode {
  return parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowHashBang: true,
    allowReturnOutsideFunction: true,
  }) as unknown as AstNode
}

export function escapeKnownReactUrlConstants(source: string): string {
  const literals: StringLiteralNode[] = []
  collectStringLiteralNodes(parseJavaScript(source), literals)

  return literals
    .filter((literal) => knownReactUrlConstants.has(literal.value))
    .sort((left, right) => right.start - left.start)
    .reduce(
      (result, literal) =>
        `${result.slice(0, literal.start + 1)}${escapedProtocolUrl(literal.value)}${result.slice(literal.end - 1)}`,
      source,
    )
}

export function assertNoUnexpectedLiteralHttpUrls(
  fileName: string,
  source: string,
  allowedExactValues: ReadonlySet<string> = new Set(),
): void {
  literalHttpUrlPattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = literalHttpUrlPattern.exec(source)) !== null) {
    const allowed = [...allowedExactValues].some((value) => {
      if (source.slice(match!.index, match!.index + value.length) !== value) {
        return false
      }
      const nextCharacter = source[match!.index + value.length]
      return (
        nextCharacter === undefined ||
        /[\s"'<>),;\]}]/.test(nextCharacter)
      )
    })
    if (allowed) {
      continue
    }
    const context = source.slice(
      Math.max(0, match.index - 40),
      Math.min(source.length, match.index + 120),
    )
    literalHttpUrlPattern.lastIndex = 0
    throw new Error(
      `Built asset ${fileName} contains an unexpected literal HTTP URL near ${JSON.stringify(context)}`,
    )
  }
  literalHttpUrlPattern.lastIndex = 0
}

function throwNonLocalReference(fileName: string, reference: string): never {
  throw new Error(
    `Built asset ${fileName} contains a non-local resource reference: ${JSON.stringify(reference)}`,
  )
}

function resolveLocalPathReference(
  fileName: string,
  reference: string,
  basePath = fileName,
  allowInline = true,
): string | undefined {
  const value = reference.trim()
  if (value === '') return basePath
  if (value.startsWith('#')) {
    if (allowInline) return undefined
    return throwNonLocalReference(fileName, reference)
  }
  if (value.startsWith('data:') || value.startsWith('blob:')) {
    if (allowInline) return undefined
    return throwNonLocalReference(fileName, reference)
  }

  let decodedValue: string
  try {
    decodedValue = decodeURIComponent(value)
  } catch {
    return throwNonLocalReference(fileName, reference)
  }
  const urlValue = decodedValue.replace(/[\t\n\r]/g, '')
  const slashNormalizedValue = urlValue.replaceAll('\\', '/')
  if (
    slashNormalizedValue.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(urlValue)
  ) {
    return throwNonLocalReference(fileName, reference)
  }

  const pathPart = slashNormalizedValue.split(/[?#]/, 1)[0]
  if (pathPart === '') return basePath

  const baseDirectory = basePath.endsWith('/')
    ? basePath
    : posix.dirname(basePath)
  const unresolvedPath = pathPart.startsWith('/')
    ? pathPart.slice(1)
    : posix.join(baseDirectory, pathPart)
  let resolvedPath = posix.normalize(unresolvedPath)
  if (resolvedPath === '..' || resolvedPath.startsWith('../')) {
    return throwNonLocalReference(fileName, reference)
  }

  const lastSegment = pathPart.slice(pathPart.lastIndexOf('/') + 1)
  const resolvesToDirectory =
    pathPart.endsWith('/') || lastSegment === '.' || lastSegment === '..'
  if (resolvedPath === '.') resolvedPath = ''
  if (resolvesToDirectory && resolvedPath !== '' && !resolvedPath.endsWith('/')) {
    resolvedPath += '/'
  }
  return resolvedPath
}

function assertLocalReference(
  fileName: string,
  reference: string,
  basePath = fileName,
): void {
  resolveLocalPathReference(fileName, reference, basePath)
}

function resolveLocalXmlBase(
  fileName: string,
  reference: string,
  inheritedBasePath: string,
): string {
  return (
    resolveLocalPathReference(
      fileName,
      reference,
      inheritedBasePath,
      false,
    ) ?? inheritedBasePath
  )
}

type HtmlNode = DefaultTreeAdapterMap['node']
type HtmlElement = DefaultTreeAdapterMap['element']
type HtmlText = DefaultTreeAdapterMap['textNode']
type HtmlTemplate = DefaultTreeAdapterMap['template']

function isHtmlElement(node: HtmlNode): node is HtmlElement {
  return 'tagName' in node && 'attrs' in node
}

function isHtmlText(node: HtmlNode): node is HtmlText {
  return node.nodeName === '#text' && 'value' in node
}

function isHtmlTemplate(element: HtmlElement): element is HtmlTemplate {
  return element.tagName === 'template' && 'content' in element
}

function getHtmlAttribute(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value
}

function getHtmlText(element: HtmlElement): string {
  return element.childNodes
    .filter(isHtmlText)
    .map((child) => child.value)
    .join('')
}

function extractMetaRefreshUrl(content: string): string | undefined {
  const separator = content.indexOf(';')
  if (separator === -1) {
    return undefined
  }
  const directive = content.slice(separator + 1).trim()
  const match = /^url\s*=\s*(.*)$/is.exec(directive)
  if (!match) {
    return undefined
  }
  const value = match[1].trim()
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function validateSrcset(
  fileName: string,
  source: string,
  basePath = fileName,
): void {
  let candidates: ReturnType<typeof parseSrcset>
  try {
    candidates = parseSrcset(source)
  } catch (error) {
    throw new Error(
      `Built asset ${fileName} srcset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  for (const candidate of candidates) {
    assertLocalReference(fileName, candidate.url, basePath)
  }
}

const htmlSrcElements = new Set([
  'audio',
  'embed',
  'iframe',
  'img',
  'input',
  'script',
  'source',
  'track',
  'video',
])
const htmlBackgroundElements = new Set(['body', 'table', 'td', 'th'])

function validateHtmlElement(
  fileName: string,
  element: HtmlElement,
  srcdocDepth: number,
): void {
  const tagName = element.tagName.toLowerCase()
  const resourceAttributes: string[] = []

  if (getHtmlAttribute(element, 'href') !== undefined) resourceAttributes.push('href')
  if (htmlSrcElements.has(tagName)) resourceAttributes.push('src')
  if (tagName === 'video') resourceAttributes.push('poster')
  if (tagName === 'form') resourceAttributes.push('action')
  if (tagName === 'button' || tagName === 'input') resourceAttributes.push('formaction')
  if (tagName === 'object') resourceAttributes.push('data')
  if (htmlBackgroundElements.has(tagName)) resourceAttributes.push('background')

  for (const name of resourceAttributes) {
    const value = getHtmlAttribute(element, name)
    if (value !== undefined) assertLocalReference(fileName, value)
  }

  const srcset = getHtmlAttribute(element, 'srcset')
  if (srcset !== undefined && (tagName === 'img' || tagName === 'source')) {
    validateSrcset(fileName, srcset)
  }

  const srcdoc = getHtmlAttribute(element, 'srcdoc')
  if (tagName === 'iframe' && srcdoc !== undefined) {
    if (srcdocDepth >= maxSrcdocDepth) {
      throw new Error(`Built asset ${fileName} iframe srcdoc nesting is too deep`)
    }
    validateHtmlReferences(fileName, srcdoc, srcdocDepth + 1)
  }

  const style = getHtmlAttribute(element, 'style')
  if (style !== undefined) {
    validateCssReferences(fileName, style, 'declarationList')
  }

  if (tagName === 'style') {
    validateCssReferences(fileName, getHtmlText(element), 'stylesheet')
  }

  if (
    tagName === 'meta' &&
    getHtmlAttribute(element, 'http-equiv')?.trim().toLowerCase() === 'refresh'
  ) {
    const content = getHtmlAttribute(element, 'content')
    const refreshUrl = content && extractMetaRefreshUrl(content)
    if (refreshUrl !== undefined) assertLocalReference(fileName, refreshUrl)
  }
}

function walkHtml(fileName: string, node: HtmlNode, srcdocDepth: number): void {
  if (isHtmlElement(node)) {
    validateHtmlElement(fileName, node, srcdocDepth)
    if (isHtmlTemplate(node)) walkHtml(fileName, node.content, srcdocDepth)
  }
  if ('childNodes' in node) {
    for (const child of node.childNodes) walkHtml(fileName, child, srcdocDepth)
  }
}

function validateHtmlReferences(
  fileName: string,
  source: string,
  srcdocDepth = 0,
): void {
  const parseErrors: string[] = []
  let root: DefaultTreeAdapterMap['document'] | DefaultTreeAdapterMap['documentFragment']
  const options = {
    onParseError(error: { code: string }) {
      parseErrors.push(error.code)
    },
  }
  try {
    root = srcdocDepth === 0
      ? parseHtml(source, options)
      : parseHtmlFragment(source, options)
  } catch (error) {
    throw new Error(
      `Built asset ${fileName} HTML could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (parseErrors.length > 0) {
    throw new Error(
      `Built asset ${fileName} HTML parse error: ${parseErrors.join(', ')}`,
    )
  }
  walkHtml(fileName, root, srcdocDepth)
}

function validateCssReferences(
  fileName: string,
  source: string,
  context: 'stylesheet' | 'declarationList' = 'stylesheet',
  basePath = fileName,
): void {
  const parseErrors: string[] = []
  let ast: csstree.CssNode
  try {
    ast = csstree.parse(source, {
      context,
      positions: true,
      parseCustomProperty: true,
      onParseError(error) {
        parseErrors.push(error.formattedMessage || error.message)
      },
    })
  } catch (error) {
    throw new Error(
      `Built asset ${fileName} CSS could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (parseErrors.length > 0) {
    throw new Error(
      `Built asset ${fileName} CSS parse error: ${parseErrors.join('; ')}`,
    )
  }

  csstree.walk(ast, (node) => {
    if (node.type === 'Raw') {
      throw new Error(`Built asset ${fileName} CSS parse error: raw fallback node`)
    }
    if (node.type === 'Url') {
      assertLocalReference(fileName, node.value, basePath)
    }
    if (node.type === 'Function') {
      const functionName = csstree.ident.decode(node.name).toLowerCase()
      if (
        functionName === 'image-set' ||
        functionName === '-webkit-image-set'
      ) {
        node.children.forEach((child) => {
          if (child.type === 'String') {
            assertLocalReference(fileName, child.value, basePath)
          }
        })
      }
    }
    if (
      node.type === 'Atrule' &&
      csstree.ident.decode(node.name).toLowerCase() === 'import'
    ) {
      const first =
        node.prelude?.type === 'AtrulePrelude'
          ? node.prelude.children.first
          : null
      if (!first || (first.type !== 'String' && first.type !== 'Url')) {
        throw new Error(`Built asset ${fileName} CSS @import could not be parsed`)
      }
      assertLocalReference(fileName, first.value, basePath)
    }
  })
}

function parseXmlDocument(fileName: string, source: string): XmlDocument {
  const parseErrors: string[] = []
  try {
    const document = new DOMParser({
      onError(level, message) {
        parseErrors.push(`${level}: ${message}`)
      },
    }).parseFromString(source, 'application/xml')
    if (parseErrors.length > 0) {
      throw new Error(parseErrors.join('; '))
    }
    return document
  } catch (error) {
    throw new Error(
      `Built asset ${fileName} XML could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function parseXmlStylesheetHref(fileName: string, data: string): string {
  const document = parseXmlDocument(fileName, `<stylesheet ${data}/>`)
  const root = document.documentElement
  if (!root) {
    throw new Error(`Built asset ${fileName} XML stylesheet instruction has no root`)
  }
  const href = root.getAttribute('href')
  if (href === null) {
    throw new Error(`Built asset ${fileName} XML stylesheet instruction has no href`)
  }
  return href
}

function getXmlBase(element: XmlElement): string | undefined {
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index)
    if (!attribute) continue
    if (
      attribute.name.toLowerCase() === 'xml:base' ||
      (attribute.namespaceURI === 'http://www.w3.org/XML/1998/namespace' &&
        attribute.localName?.toLowerCase() === 'base')
    ) {
      return attribute.value
    }
  }
  return undefined
}

function validateXmlReferences(fileName: string, source: string): void {
  const document = parseXmlDocument(fileName, source)
  const visit = (node: XmlNode, inheritedBasePath: string): void => {
    let childBasePath = inheritedBasePath
    if (node.nodeType === 1) {
      const element = node as XmlElement
      const xmlBase = getXmlBase(element)
      if (xmlBase !== undefined) {
        childBasePath = resolveLocalXmlBase(
          fileName,
          xmlBase,
          inheritedBasePath,
        )
      }

      for (let index = 0; index < element.attributes.length; index += 1) {
        const attribute = element.attributes.item(index)
        if (!attribute) continue
        const name = attribute.name.toLowerCase()
        const localName = attribute.localName?.toLowerCase()
        if (
          name === 'href' ||
          name === 'xlink:href' ||
          localName === 'href' ||
          name === 'src' ||
          name === 'data' ||
          name === 'background'
        ) {
          assertLocalReference(fileName, attribute.value, childBasePath)
        } else if (name === 'srcset') {
          validateSrcset(fileName, attribute.value, childBasePath)
        } else if (name === 'style') {
          validateCssReferences(
            fileName,
            attribute.value,
            'declarationList',
            childBasePath,
          )
        }
      }
      if (element.tagName.toLowerCase() === 'style') {
        validateCssReferences(
          fileName,
          element.textContent ?? '',
          'stylesheet',
          childBasePath,
        )
      }
    } else if (
      node.nodeType === 7 &&
      node.nodeName.toLowerCase() === 'xml-stylesheet'
    ) {
      assertLocalReference(
        fileName,
        parseXmlStylesheetHref(fileName, node.nodeValue ?? ''),
        inheritedBasePath,
      )
    } else if (node.nodeType === 10) {
      const documentType = node as XmlDocumentType
      if (documentType.systemId) {
        assertLocalReference(fileName, documentType.systemId, inheritedBasePath)
      }
    }

    for (let child = node.firstChild; child; child = child.nextSibling) {
      visit(child, childBasePath)
    }
  }
  visit(document, fileName)
}

function validateManifestReferences(fileName: string, source: string): void {
  const manifest = JSON.parse(source) as Record<string, unknown>
  const references: string[] = []
  const addString = (value: unknown) => {
    if (typeof value === 'string') references.push(value)
  }
  const addStringArray = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) addString(item)
    }
  }
  const addRecordValues = (value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const item of Object.values(value as Record<string, unknown>)) {
        addString(item)
      }
    }
  }
  const addObjectArrayFields = (value: unknown, fields: string[]) => {
    if (!Array.isArray(value)) return
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const record = item as Record<string, unknown>
      for (const field of fields) addStringArray(record[field])
    }
  }

  const action = manifest.action as Record<string, unknown> | undefined
  const background = manifest.background as Record<string, unknown> | undefined
  const optionsUi = manifest.options_ui as Record<string, unknown> | undefined
  const sandbox = manifest.sandbox as Record<string, unknown> | undefined
  const sidePanel = manifest.side_panel as Record<string, unknown> | undefined
  const theme = manifest.theme as Record<string, unknown> | undefined
  const userScripts = manifest.user_scripts as Record<string, unknown> | undefined

  addString(sidePanel?.default_path)
  addString(background?.service_worker)
  addStringArray(background?.scripts)
  addString(action?.default_popup)
  addRecordValues(action?.default_icon)
  addRecordValues(manifest.icons)
  addString(manifest.devtools_page)
  addString(manifest.options_page)
  addString(optionsUi?.page)
  addRecordValues(manifest.chrome_url_overrides)
  addStringArray(sandbox?.pages)
  addRecordValues(theme?.images)
  addString(userScripts?.api_script)
  addObjectArrayFields(manifest.content_scripts, ['js', 'css'])
  addObjectArrayFields(manifest.web_accessible_resources, ['resources'])

  if (Array.isArray(manifest.nacl_modules)) {
    for (const item of manifest.nacl_modules) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        addString((item as Record<string, unknown>).path)
      }
    }
  }

  for (const reference of references) {
    assertLocalReference(fileName, reference)
  }
}

function validateTextAsset(fileName: string, source: string): void {
  const extension = extname(fileName).toLowerCase()
  const isXml = extension === '.svg' || extension === '.xml'
  assertNoUnexpectedLiteralHttpUrls(
    fileName,
    source,
    isXml ? xmlNamespaceIdentifiers : undefined,
  )
  if (extension === '.html' || extension === '.htm') {
    validateHtmlReferences(fileName, source)
  } else if (extension === '.css') {
    validateCssReferences(fileName, source)
  } else if (isXml) {
    validateXmlReferences(fileName, source)
  } else if (fileName === 'manifest.json') {
    validateManifestReferences(fileName, source)
  }
}

function readUint32BigEndian(source: Uint8Array, offset: number): number {
  return (
    source[offset] * 0x1000000 +
    source[offset + 1] * 0x10000 +
    source[offset + 2] * 0x100 +
    source[offset + 3]
  )
}

function validatePngIcon(fileName: string, source: Uint8Array): void {
  if (
    source.length < 24 ||
    pngSignature.some((byte, index) => source[index] !== byte)
  ) {
    throw new Error(`Built asset ${fileName} has an invalid PNG signature`)
  }
  const expectedSize = allowedPngDimensions.get(fileName)
  if (expectedSize === undefined) {
    throw new Error(`Built asset ${fileName} binary asset is not allowed`)
  }
  const width = readUint32BigEndian(source, 16)
  const height = readUint32BigEndian(source, 20)
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(
      `Built asset ${fileName} PNG dimensions do not match ${expectedSize}x${expectedSize}`,
    )
  }
}

export function validateGeneratedAsset(
  fileName: string,
  source: string | Uint8Array,
): void {
  const extension = extname(fileName).toLowerCase()

  if (typeof source === 'string') {
    if (!textExtensions.has(extension)) {
      throw new Error(
        `Built asset ${fileName} binary asset must use Uint8Array data`,
      )
    }
    validateTextAsset(fileName, source)
    return
  }

  if (textExtensions.has(extension)) {
    let text: string
    try {
      text = utf8Decoder.decode(source)
    } catch {
      throw new Error(`Built asset ${fileName} is not valid UTF-8 text`)
    }
    validateTextAsset(fileName, text)
    return
  }

  if (fileName.endsWith('.png')) {
    validatePngIcon(fileName, source)
    return
  }

  throw new Error(`Built asset ${fileName} binary asset is not allowed`)
}

function getAssetSource(output: OutputAsset | OutputChunk): string | Uint8Array {
  return output.type === 'chunk' ? output.code : output.source
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    }),
  )
  return files.flat()
}

export async function validateOutputDirectory(directory: string): Promise<void> {
  for (const absolutePath of await listFiles(directory)) {
    const fileName = relative(directory, absolutePath).split(sep).join('/')
    validateGeneratedAsset(fileName, new Uint8Array(await readFile(absolutePath)))
  }
}

export function escapeKnownReactUrlConstantsPlugin(): Plugin {
  return {
    name: 'escape-known-react-url-constants',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          output.code = escapeKnownReactUrlConstants(output.code)
        }
        validateGeneratedAsset(output.fileName, getAssetSource(output))
      }
    },
  }
}
