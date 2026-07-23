import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertNoUnexpectedLiteralHttpUrls,
  escapeKnownReactUrlConstants,
  validateGeneratedAsset,
  validateOutputDirectory,
} from './escapeUrlProtocols'
import { validateFinalDist } from './validateDist'

const knownRuntimeValues = [
  'https://react.dev/errors/',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
]

describe('escapeKnownReactUrlConstants', () => {
  it('escapes only exact quoted React diagnostic and W3C namespace constants', () => {
    const source = `return ${JSON.stringify(knownRuntimeValues)}`

    const escaped = escapeKnownReactUrlConstants(source)

    expect(escaped).not.toMatch(/https?:\/\//)
    expect(escaped).toContain('"https\\x3a//react.dev/errors/"')
    expect(escaped).toContain('"http\\x3a//www.w3.org/2000/svg"')
    expect(escaped).toContain('"http\\x3a//www.w3.org/1998/Math/MathML"')
    expect(escaped).toContain('"http\\x3a//www.w3.org/1999/xlink"')
    expect(escaped).toContain('"http\\x3a//www.w3.org/XML/1998/namespace"')
    expect(new Function(escaped)()).toEqual(knownRuntimeValues)
  })

  it('preserves matching single-quoted runtime values', () => {
    const source =
      "return ['https://react.dev/errors/','http://www.w3.org/2000/svg']"

    const escaped = escapeKnownReactUrlConstants(source)

    expect(escaped).toContain("'https\\x3a//react.dev/errors/'")
    expect(escaped).toContain("'http\\x3a//www.w3.org/2000/svg'")
    expect(new Function(escaped)()).toEqual(knownRuntimeValues.slice(0, 2))
  })

  it('leaves unrelated URLs, templates, regex literals, and comments untouched', () => {
    const source = [
      'const remote = "https://example.com/asset.js";',
      'const similar = "https://react.dev/errors/418";',
      'const template = `https://react.dev/errors/`;',
      String.raw`const pattern = /"https:\/\/react\.dev\/errors\/"/;`,
      '// "https://react.dev/errors/" is documentation text',
      "/* 'http://www.w3.org/2000/svg' is documentation text */",
    ].join('\n')

    expect(escapeKnownReactUrlConstants(source)).toBe(source)
  })
})

describe('assertNoUnexpectedLiteralHttpUrls', () => {
  it('accepts output after all known React constants are escaped', () => {
    const escaped = escapeKnownReactUrlConstants(
      `return ${JSON.stringify(knownRuntimeValues)}`,
    )

    expect(() =>
      assertNoUnexpectedLiteralHttpUrls('assets/react.js', escaped),
    ).not.toThrow()
  })

  it.each([
    'const remote = "https://example.com/asset.js";',
    'const template = `http://example.com/${path}`;',
    '// https://example.com/comment',
  ])('rejects any other literal HTTP URL: %s', (source) => {
    expect(() =>
      assertNoUnexpectedLiteralHttpUrls('assets/index.js', source),
    ).toThrow('Built asset assets/index.js contains an unexpected literal HTTP URL')
  })
})

describe('module syntax support', () => {
  it('parses imports, exports, and import.meta while preserving module syntax', () => {
    const source = [
      'import value from "./local.js";',
      'export const metaUrl = import.meta.url;',
      'export const namespace = "http://www.w3.org/2000/svg";',
    ].join('\n')

    const escaped = escapeKnownReactUrlConstants(source)

    expect(escaped).toContain('import value from "./local.js"')
    expect(escaped).toContain('export const metaUrl = import.meta.url')
    expect(escaped).toContain(
      'export const namespace = "http\\x3a//www.w3.org/2000/svg"',
    )
  })
})

describe('generated output policy', () => {
  it('decodes and scans UTF-8 Uint8Array text assets', () => {
    const source = new TextEncoder().encode(
      '<svg><image href="https://example.com/remote.png" /></svg>',
    )

    expect(() => validateGeneratedAsset('assets/image.svg', source)).toThrow(
      'contains an unexpected literal HTTP URL',
    )
  })

  it.each([
    ['index.html', '<!doctype html><script src="//example.com/app.js"></script>'],
    ['assets/app.css', '@import "//example.com/theme.css";'],
    [
      'manifest.json',
      JSON.stringify({
        manifest_version: 3,
        side_panel: { default_path: '//example.com/panel.html' },
      }),
    ],
  ])('rejects non-local resource references in %s', (fileName, source) => {
    expect(() => validateGeneratedAsset(fileName, source)).toThrow(
      /non-local resource reference|unexpected literal HTTP URL/,
    )
  })

  it('rejects protocol-relative manifest resources in nested resource fields', () => {
    const manifest = JSON.stringify({
      manifest_version: 3,
      content_scripts: [{ matches: ['<all_urls>'], js: ['//cdn.example.com/content.js'] }],
      web_accessible_resources: [
        { resources: ['//cdn.example.com/public.js'], matches: ['<all_urls>'] },
      ],
    })

    expect(() => validateGeneratedAsset('manifest.json', manifest)).toThrow(
      'non-local resource reference',
    )
  })

  it('accepts local manifest, HTML, and CSS resource references', () => {
    expect(() =>
      validateGeneratedAsset(
        'manifest.json',
        JSON.stringify({
          manifest_version: 3,
          side_panel: { default_path: 'index.html' },
          background: { service_worker: 'background.js' },
          action: { default_icon: { 16: 'icons/icon-16.png' } },
          icons: { 16: 'icons/icon-16.png' },
        }),
      ),
    ).not.toThrow()
    expect(() =>
      validateGeneratedAsset(
        'index.html',
        '<!doctype html><script src=/assets/index.js></script><link href=/assets/index.css>',
      ),
    ).not.toThrow()
    expect(() =>
      validateGeneratedAsset(
        'assets/index.css',
        '@font-face{src:url("../icons/icon-16.png")} .x{background:url(data:image/png;base64,AA==)}',
      ),
    ).not.toThrow()
  })

  it('allows only declared icon PNG paths with matching magic and dimensions', () => {
    const png16 = new Uint8Array(24)
    png16.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
    png16.set([0, 0, 0, 16, 0, 0, 0, 16], 16)

    expect(() => validateGeneratedAsset('icons/icon-16.png', png16)).not.toThrow()
    expect(() => validateGeneratedAsset('assets/other.png', png16)).toThrow(
      'binary asset is not allowed',
    )
    expect(() =>
      validateGeneratedAsset('icons/icon-32.png', png16),
    ).toThrow('PNG dimensions do not match')
    expect(() =>
      validateGeneratedAsset('icons/icon-16.png', new Uint8Array([1, 2, 3])),
    ).toThrow('invalid PNG signature')
    expect(() =>
      validateGeneratedAsset('icons/icon-16.png', 'not binary PNG data'),
    ).toThrow('binary asset must use Uint8Array data')
  })

  it.each([
    ['src', '<script src=//cdn.example.com/app.js></script>'],
    ['href', '<link href=&#x2f;&#x2f;cdn.example.com/app.css>'],
    ['poster', '<video poster=//cdn.example.com/poster.png></video>'],
    ['action', '<form action=//cdn.example.com/submit></form>'],
    ['src', '<script src=h&#x09;ttps://cdn.example.com/app.js></script>'],
  ])('uses the HTML parser to reject an unquoted or entity-obscured %s', (_attribute, body) => {
    expect(() =>
      validateGeneratedAsset('index.html', `<!doctype html>${body}`),
    ).toThrow('non-local resource reference')
  })

  it('parses srcset candidates instead of splitting them with a regular expression', () => {
    const html = [
      '<!doctype html>',
      '<img srcset="data:image/svg+xml,%3Csvg%3E 1x, &#x2f;&#x2f;cdn.example.com/two.png 2x">',
    ].join('')

    expect(() => validateGeneratedAsset('index.html', html)).toThrow(
      'non-local resource reference',
    )
  })

  it('rejects entity-obscured meta refresh URLs', () => {
    const html =
      '<!doctype html><meta http-equiv=refresh content="0; URL=&#x68;ttps://example.com/next">'

    expect(() => validateGeneratedAsset('index.html', html)).toThrow(
      'non-local resource reference',
    )
  })

  it.each([
    '../../../outside.js',
    '%2e%2e/%2e%2e/%2e%2e/outside.js',
    '..%2f..%2f..%2foutside.js',
  ])('rejects HTML paths that escape the output root: %s', (reference) => {
    expect(() =>
      validateGeneratedAsset(
        'nested/pages/index.html',
        `<!doctype html><script src=${reference}></script>`,
      ),
    ).toThrow('non-local resource reference')
  })

  it.each([
    'a{background-image:url(https\\3a //example.com/image.png)}',
    '@import "h\\74tps\\3a //example.com/theme.css";',
    ':root{--remote:url(https\\3a //example.com/custom.png)}',
  ])('uses the CSS parser to reject escaped remote references: %s', (css) => {
    expect(() => validateGeneratedAsset('assets/app.css', css)).toThrow(
      'non-local resource reference',
    )
  })

  it.each([
    String.raw`@\69 mport "//example.com/theme.css";`,
    String.raw`@im\70 ort "https\3a //example.com/theme.css";`,
    String.raw`@\000069mport "../../../outside.css";`,
  ])('decodes escaped CSS at-rule identifiers before validating @import: %s', (css) => {
    expect(() => validateGeneratedAsset('assets/app.css', css)).toThrow(
      'non-local resource reference',
    )
  })

  it('allows local references in escaped @import rules', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/app.css',
        String.raw`@\69 mport "./local.css"; @im\70 ort url(../shared.css);`,
      ),
    ).not.toThrow()
  })

  it.each([
    'a{background:image-set("https\\3a //example.com/one.png" 1x)}',
    'a{background:-webkit-image-set("//example.com/two.png" 2x)}',
    'a{background:image-set("../../../outside.png" 1x)}',
  ])('validates string image candidates inside image-set functions: %s', (css) => {
    expect(() => validateGeneratedAsset('assets/app.css', css)).toThrow(
      'non-local resource reference',
    )
  })

  it.each([
    String.raw`a{background:im\61 ge-set("//example.com/one.png" 1x)}`,
    String.raw`a{background:\69 mage-set("https\3a //example.com/two.png" 2x)}`,
    String.raw`a{background:-webkit-im\61 ge-set("../../../outside.png" 1x)}`,
    String.raw`a{background:\2d webkit-image-set("//example.com/four.png" 2x)}`,
  ])('decodes escaped CSS function identifiers before validating image-set: %s', (css) => {
    expect(() => validateGeneratedAsset('assets/app.css', css)).toThrow(
      'non-local resource reference',
    )
  })

  it('allows local and data image-set string candidates', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/app.css',
        'a{background:image-set("./one.png" 1x,"data:image/png;base64,AA==" 2x,url(../icons/icon-16.png) 3x)}',
      ),
    ).not.toThrow()
  })

  it('allows local candidates in image-set functions with escaped identifiers', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/app.css',
        String.raw`a{background:im\61 ge-set("./one.png" 1x)}b{background:\2d webkit-image-set("data:image/png;base64,AA==" 2x)}`,
      ),
    ).not.toThrow()
  })

  it('does not treat nested non-URL image-set strings as resource candidates', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/app.css',
        'a{background:image-set("./one.png" type("image/png") 1x)}',
      ),
    ).not.toThrow()
  })

  it('parses CSS in style elements and style attributes', () => {
    const html = [
      '<!doctype html>',
      '<style>.remote{background:url(https\\3a //example.com/style.png)}</style>',
      '<div style="background:url(//example.com/attribute.png)"></div>',
    ].join('')

    expect(() => validateGeneratedAsset('index.html', html)).toThrow(
      'non-local resource reference',
    )
  })

  it.each([
    ['object data', '<object data=&#x2f;&#x2f;example.com/object.bin></object>'],
    ['body background', '<body background=//example.com/body.png></body>'],
    ['table background', '<table background=//example.com/table.png></table>'],
    ['td background', '<table><tr><td background=//example.com/cell.png></td></tr></table>'],
    ['th background', '<table><tr><th background=//example.com/head.png></th></tr></table>'],
    ['button formaction', '<form><button formaction=//example.com/submit>Go</button></form>'],
    ['input formaction', '<form><input type=submit formaction=//example.com/submit></form>'],
    ['form action', '<form action=//example.com/submit></form>'],
    ['script src', '<script src=//example.com/app.js></script>'],
    ['img src', '<img src=//example.com/image.png>'],
    ['video src', '<video src=//example.com/video.mp4></video>'],
    ['link href', '<link rel=stylesheet href=//example.com/theme.css>'],
    ['iframe src', '<iframe src=//example.com/frame.html></iframe>'],
    ['embed src', '<embed src=//example.com/plugin.bin>'],
    ['audio src', '<audio src=//example.com/audio.mp3></audio>'],
    ['source src', '<video><source src=//example.com/video.mp4></video>'],
    ['track src', '<video><track src=//example.com/subtitles.vtt></video>'],
    ['input src', '<input type=image src=//example.com/button.png>'],
  ])('rejects browser-loadable HTML %s references', (_name, body) => {
    expect(() =>
      validateGeneratedAsset('index.html', `<!doctype html>${body}`),
    ).toThrow('non-local resource reference')
  })

  it('recursively parses and rejects references inside iframe srcdoc', () => {
    const html = [
      '<!doctype html>',
      '<iframe srcdoc="&lt;!doctype html&gt;&lt;img src=&quot;&#x2f;&#x2f;example.com/nested.png&quot;&gt;"></iframe>',
    ].join('')

    expect(() => validateGeneratedAsset('index.html', html)).toThrow(
      'non-local resource reference',
    )
  })

  it('allows local references inside iframe srcdoc', () => {
    const html = [
      '<!doctype html>',
      '<iframe srcdoc="&lt;!doctype html&gt;&lt;img src=&quot;./nested.png&quot;&gt;"></iframe>',
    ].join('')

    expect(() => validateGeneratedAsset('index.html', html)).not.toThrow()
  })

  it('parses srcdoc with HTML fragment semantics without requiring a doctype', () => {
    expect(() =>
      validateGeneratedAsset(
        'index.html',
        '<!doctype html><iframe srcdoc="&lt;img src=&quot;./nested.png&quot;&gt;"></iframe>',
      ),
    ).not.toThrow()
    expect(() =>
      validateGeneratedAsset(
        'index.html',
        '<!doctype html><iframe srcdoc="&lt;img src=&quot;&#x2f;&#x2f;example.com/nested.png&quot;&gt;"></iframe>',
      ),
    ).toThrow('non-local resource reference')
  })

  it('rejects source srcset candidates and entity-obscured nested srcdoc schemes', () => {
    expect(() =>
      validateGeneratedAsset(
        'index.html',
        '<!doctype html><picture><source srcset="./local.png 1x, &#x2f;&#x2f;example.com/two.png 2x"></picture>',
      ),
    ).toThrow('non-local resource reference')

    const nested =
      '<!doctype html><iframe srcdoc="&lt;!doctype html&gt;&lt;iframe srcdoc=&quot;&amp;lt;!doctype html&amp;gt;&amp;lt;img src=&amp;quot;h&amp;amp;#x74;tps://example.com/nested.png&amp;quot;&amp;gt;&quot;&gt;&lt;/iframe&gt;"></iframe>'
    expect(() => validateGeneratedAsset('index.html', nested)).toThrow(
      'non-local resource reference',
    )
  })

  it.each([
    [
      'assets/image.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="&#x2f;&#x2f;example.com/image.png"/></svg>',
    ],
    [
      'assets/image.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="//example.com/icons.svg#x"/></svg>',
    ],
    ['assets/feed.xml', '<root><object data="//example.com/object.bin"/></root>'],
    ['assets/feed.xml', '<root><media src="h&#x74;tps://example.com/media.bin"/></root>'],
    [
      'assets/feed.xml',
      '<root><media srcset="./local.png 1x, &#x2f;&#x2f;example.com/two.png 2x"/></root>',
    ],
    ['assets/feed.xml', '<root><item background="../../../outside.png"/></root>'],
    [
      'assets/feed.xml',
      '<?xml-stylesheet type="text/css" href="&#x2f;&#x2f;example.com/theme.css"?><root/>',
    ],
    [
      'assets/image.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="h&#x74;tps://example.com/image.png"/></svg>',
    ],
    [
      'assets/feed.xml',
      '<?xml-stylesheet href="h&#x74;tps://example.com/theme.css"?><root/>',
    ],
    [
      'assets/image.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{background:url(https\\3a //example.com/x.png)}</style></svg>',
    ],
  ])('rejects remote or escaping XML/SVG references in %s', (fileName, source) => {
    expect(() => validateGeneratedAsset(fileName, source)).toThrow(
      'non-local resource reference',
    )
  })

  it.each([
    '<svg xml:base="h&#x74;tps://example.com/assets/"><image href="local.png"/></svg>',
    '<svg xml:base="&#x2f;&#x2f;example.com/assets/"><image href="local.png"/></svg>',
    '<svg xml:base="../../../outside/"><image href="local.png"/></svg>',
  ])('rejects non-local or escaping xml:base values: %s', (source) => {
    expect(() =>
      validateGeneratedAsset('assets/deep/image.svg', source),
    ).toThrow('non-local resource reference')
  })

  it('resolves descendant references against inherited local xml:base values', () => {
    expect(() =>
      validateGeneratedAsset(
        'nested/deep/image.svg',
        '<svg xml:base="../../safe/"><g xml:base="icons/"><image href="../pictures/local.png"/><use href="#symbol"/></g></svg>',
      ),
    ).not.toThrow()

    expect(() =>
      validateGeneratedAsset(
        'nested/deep/image.svg',
        '<svg xml:base="../../safe/"><image href="../../outside.png"/></svg>',
      ),
    ).toThrow('non-local resource reference')
  })

  it('applies inherited local xml:base to nested elements and stylesheet instructions', () => {
    expect(() =>
      validateGeneratedAsset(
        'nested/deep/feed.xml',
        '<root xml:base="../../safe/"><section xml:base="icons/"><item src="./local.png"/></section></root>',
      ),
    ).not.toThrow()

    expect(() =>
      validateGeneratedAsset(
        'nested/deep/feed.xml',
        '<?xml-stylesheet href="../../../outside.css"?><root xml:base="../../safe/"/>',
      ),
    ).toThrow('non-local resource reference')
  })

  it('uses inherited xml:base for XML srcset and inline CSS references', () => {
    expect(() =>
      validateGeneratedAsset(
        'nested/deep/feed.xml',
        '<root xml:base="../../safe/"><item srcset="./one.png 1x, icons/two.png 2x" style="background:url(./bg.png)"/></root>',
      ),
    ).not.toThrow()

    expect(() =>
      validateGeneratedAsset(
        'nested/deep/feed.xml',
        '<root xml:base="../../safe/"><item style="background:url(../../outside.png)"/></root>',
      ),
    ).toThrow('non-local resource reference')
  })

  it('allows only exact XML namespace identifiers through the literal scan', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/image.svg',
        "<svg xmlns='http://www.w3.org/2000/svg'><use href='#local'/></svg>",
      ),
    ).not.toThrow()
    expect(() =>
      validateGeneratedAsset(
        'assets/image.svg',
        '<svg xmlns="http://www.w3.org/2000/svg.evil"/>',
      ),
    ).toThrow('unexpected literal HTTP URL')
    expect(() =>
      validateGeneratedAsset(
        'assets/image.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://www.w3.org/2000/svg"/></svg>',
      ),
    ).toThrow('non-local resource reference')
  })

  it('rejects malformed standalone XML/SVG fail closed', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/image.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="local.png"></svg>',
      ),
    ).toThrow(/XML could not be parsed|XML parse error/i)
  })

  it('rejects malformed XML stylesheet pseudo-attributes fail closed', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/feed.xml',
        '<?xml-stylesheet href="./theme.css" broken?><root/>',
      ),
    ).toThrow(/XML could not be parsed|XML parse error/i)
  })

  it('allows valid local and data references in standalone SVG/XML', () => {
    expect(() =>
      validateGeneratedAsset(
        'assets/image.svg',
        '<?xml-stylesheet href="./image.css"?><svg xmlns="http://www.w3.org/2000/svg"><image href="./local.png"/><use href="#symbol"/></svg>',
      ),
    ).not.toThrow()
    expect(() =>
      validateGeneratedAsset(
        'assets/feed.xml',
        '<root><item src="data:image/png;base64,AA==" href="../local.xml"/></root>',
      ),
    ).not.toThrow()
  })

  it.each([
    ['index.html', '<!doctype html><script src=local.js'],
    ['assets/app.css', 'a{background:url("local.png"))}'],
  ])('fails closed when parsing malformed %s', (fileName, source) => {
    expect(() => validateGeneratedAsset(fileName, source)).toThrow(
      /could not be parsed|parse error/i,
    )
  })

  it('ignores reference-like text in HTML and CSS comments', () => {
    expect(() =>
      validateGeneratedAsset(
        'index.html',
        '<!doctype html><!-- <script src=//example.com/app.js></script> --><div></div>',
      ),
    ).not.toThrow()
    expect(() =>
      validateGeneratedAsset(
        'assets/app.css',
        '/* url(//example.com/comment.png) */ .local{background:url(./local.png)}',
      ),
    ).not.toThrow()
  })

  it('recursively validates the final output directory after files are written', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chrome-tabs-dist-'))
    try {
      await mkdir(join(directory, 'assets'))
      await writeFile(
        join(directory, 'index.html'),
        '<!doctype html><link href=./assets/app.css>',
      )
      await writeFile(
        join(directory, 'assets/app.css'),
        '.local{background:url(../local.png)}',
      )

      await expect(validateOutputDirectory(directory)).resolves.toBeUndefined()

      await writeFile(
        join(directory, 'assets/app.css'),
        '.remote{background:url(https\\3a //example.com/image.png)}',
      )
      await expect(validateOutputDirectory(directory)).rejects.toThrow(
        'non-local resource reference',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  async function writeLocalizedDist(
    directory: string,
    options: {
      manifest?: Record<string, unknown>
      en?: Record<string, unknown>
      zhCn?: Record<string, unknown>
    } = {},
  ) {
    const manifest = options.manifest ?? {
      manifest_version: 3,
      default_locale: 'en',
      name: '__MSG_extensionName__',
      description: '__MSG_extensionDescription__',
      action: { default_title: '__MSG_extensionActionTitle__' },
    }
    const en = options.en ?? {
      extensionName: { message: 'Tab Manager' },
      extensionDescription: { message: 'Manage tabs.' },
      extensionActionTitle: { message: 'Open tab manager' },
    }
    const zhCn = options.zhCn ?? {
      extensionName: { message: '标签页管理器' },
      extensionDescription: { message: '管理标签页。' },
      extensionActionTitle: { message: '打开标签页管理器' },
    }

    await mkdir(join(directory, '_locales', 'en'), { recursive: true })
    await mkdir(join(directory, '_locales', 'zh_CN'), { recursive: true })
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest))
    await writeFile(
      join(directory, '_locales', 'en', 'messages.json'),
      JSON.stringify(en),
    )
    await writeFile(
      join(directory, '_locales', 'zh_CN', 'messages.json'),
      JSON.stringify(zhCn),
    )
  }

  it('accepts complete matching final-dist locale resources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chrome-tabs-locales-'))
    try {
      await writeLocalizedDist(directory)
      await expect(validateFinalDist(directory)).resolves.toBeUndefined()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('requires an English default locale and every referenced manifest message', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chrome-tabs-locales-'))
    try {
      await writeLocalizedDist(directory, {
        manifest: {
          manifest_version: 3,
          default_locale: 'zh_CN',
          name: '__MSG_missingName__',
        },
      })
      await expect(validateFinalDist(directory)).rejects.toThrow(/default_locale.*en/i)

      await writeLocalizedDist(directory, {
        manifest: {
          manifest_version: 3,
          default_locale: 'en',
          name: '__MSG_missingName__',
        },
      })
      await expect(validateFinalDist(directory)).rejects.toThrow(/missingName/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('requires both English and Chinese locale files to exist', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chrome-tabs-locales-'))
    try {
      await writeLocalizedDist(directory)
      await rm(join(directory, '_locales', 'zh_CN', 'messages.json'))
      await expect(validateFinalDist(directory)).rejects.toThrow(
        /zh_CN.*messages\.json/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('requires both locale files to have identical non-empty message keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chrome-tabs-locales-'))
    try {
      await writeLocalizedDist(directory, {
        zhCn: {
          extensionName: { message: '标签页管理器' },
          extensionDescription: { message: '管理标签页。' },
        },
      })
      await expect(validateFinalDist(directory)).rejects.toThrow(/locale keys/i)

      await writeLocalizedDist(directory, {
        en: {
          extensionName: { message: '   ' },
          extensionDescription: { message: 'Manage tabs.' },
          extensionActionTitle: { message: 'Open tab manager' },
        },
      })
      await expect(validateFinalDist(directory)).rejects.toThrow(/extensionName.*empty/i)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('runs the standalone final-dist validator against the requested directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chrome-tabs-final-dist-'))
    try {
      await writeLocalizedDist(directory)
      await writeFile(
        join(directory, 'index.html'),
        '<!doctype html><script src=//cdn.example.com/app.js></script>',
      )

      await expect(validateFinalDist(directory)).rejects.toThrow(
        'non-local resource reference',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps standalone final-dist validation after the completed Vite command', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.build).toBe(
      'tsc -b && vite build && node --import tsx build/validateDist.ts dist',
    )
  })
})
