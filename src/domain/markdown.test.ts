import { describe, expect, it } from 'vitest'
import {
  EmptyPageError,
  absolutizeLinks,
  convertPageToMarkdown,
  createFrontMatter,
} from './markdown'

const capturedAt = new Date('2026-11-18T10:30:00+08:00')

function articlePage(body: string, head = '') {
  return `<!doctype html><html><head><title>Ignored head title</title>${head}</head><body>
    <nav><a href="/home">Home</a> <a href="/about">About</a></nav>
    <article>
      <h1>Release notes</h1>
      ${body}
    </article>
    <footer>Copyright footer text</footer>
  </body></html>`
}

const longParagraph = (n: number) =>
  `<p>Paragraph ${n} explains the change in enough detail that Readability treats this block as the main article body, with commas, clauses, and plenty of words to score well.</p>`

describe('absolutizeLinks', () => {
  function fragment(html: string) {
    const container = document.createElement('div')
    container.innerHTML = html
    return container
  }

  it('resolves relative links, anchors and images against the page URL', () => {
    const root = fragment(`
      <a href="/docs/guide?x=1">Guide</a>
      <a href="../up">Up</a>
      <a href="#install">Install</a>
      <a href="mailto:team@example.com">Mail</a>
      <img src="img/a.png" alt="A">
      <img srcset="small.png 1x, //cdn.example.com/big.png 2x" alt="B">
    `)
    absolutizeLinks(root, 'https://example.com/blog/post/')

    expect([...root.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://example.com/docs/guide?x=1',
      'https://example.com/blog/up',
      'https://example.com/blog/post/#install',
      'mailto:team@example.com',
    ])
    const images = [...root.querySelectorAll('img')]
    expect(images[0].getAttribute('src')).toBe('https://example.com/blog/post/img/a.png')
    expect(images[1].getAttribute('src')).toBe('https://example.com/blog/post/small.png')
    expect(images[1].getAttribute('srcset')).toBe(
      'https://example.com/blog/post/small.png 1x, https://cdn.example.com/big.png 2x',
    )
  })

  it('drops script and data links but keeps their text', () => {
    const root = fragment(`
      <a href="javascript:alert(1)">Run</a>
      <a href="data:text/html,x">Data</a>
      <a>No href</a>
      <img src="data:image/png;base64,AAAA" alt="inline">
    `)
    absolutizeLinks(root, 'https://example.com/')

    expect(root.querySelectorAll('a')).toHaveLength(0)
    expect(root.querySelectorAll('img')).toHaveLength(0)
    expect(root.textContent).toContain('Run')
    expect(root.textContent).toContain('Data')
    expect(root.textContent).toContain('No href')
  })
})

describe('createFrontMatter', () => {
  it('quotes and escapes every value and skips empty optional fields', () => {
    expect(createFrontMatter({
      title: 'Title: with "quotes"\nand a newline',
      source: 'https://example.com/a?b=c#d',
      site: 'Example',
      author: '   ',
      published: null,
      captured: '2026-11-18T10:30:00+08:00',
    })).toBe([
      '---',
      'title: "Title: with \\"quotes\\" and a newline"',
      'source: "https://example.com/a?b=c#d"',
      'site: "Example"',
      'captured: "2026-11-18T10:30:00+08:00"',
      '---',
    ].join('\n'))
  })

  it('marks truncated captures', () => {
    expect(createFrontMatter({
      title: 'T',
      source: 'https://example.com/',
      captured: 'now',
      truncated: true,
    })).toContain('\ntruncated: true\n---')
  })
})

describe('convertPageToMarkdown', () => {
  it('extracts the article, absolutizes links and converts rich content', () => {
    const html = articlePage(`
      ${longParagraph(1)}
      <h2>Install</h2>
      <p>Read the <a href="/docs/install">install guide</a> or jump to <a href="#usage">usage</a>.</p>
      <ul><li>First item</li><li>Second <strong>bold</strong> item</li></ul>
      <pre><code class="language-ts">const x: number = 1</code></pre>
      <table><thead><tr><th>Name</th><th>Size</th></tr></thead><tbody><tr><td>core</td><td>8 KB</td></tr></tbody></table>
      <p><img src="/img/shot.png" alt="Screenshot"> <del>old</del></p>
      ${longParagraph(2)}
      ${longParagraph(3)}
    `, '<meta name="author" content="Ada Lovelace"><meta property="og:site_name" content="Example Blog">')

    const result = convertPageToMarkdown({
      html,
      url: 'https://example.com/blog/release',
      title: 'Release notes - Example Blog',
    }, capturedAt)

    expect(result.extracted).toBe(true)
    const [, frontMatter, body] = result.markdown.split(/^---$/m)
    expect(frontMatter).toContain('source: "https://example.com/blog/release"')
    expect(frontMatter).toContain('site: "Example Blog"')
    expect(frontMatter).toContain('author: "Ada Lovelace"')
    expect(frontMatter).toMatch(/captured: "2026-11-18T\d\d:30:00[+-]\d\d:\d\d"/)
    expect(body.trimStart().startsWith(`# ${result.title}\n`)).toBe(true)
    expect(body).toContain('## Install')
    expect(body).toContain('[install guide](https://example.com/docs/install)')
    expect(body).toContain('[usage](https://example.com/blog/release#usage)')
    expect(body).toMatch(/^-\s+First item$/m)
    expect(body).toContain('**bold**')
    expect(body).toContain('```ts\nconst x: number = 1\n```')
    expect(body).toContain('| Name | Size |')
    expect(body).toContain('| core | 8 KB |')
    expect(body).toContain('![Screenshot](https://example.com/img/shot.png)')
    expect(body).toContain('~old~')
    expect(body).not.toContain('Copyright footer text')
    expect(body).not.toContain('[Home]')
  })

  it('converts short pages that are not article-shaped', () => {
    const result = convertPageToMarkdown({
      html: '<html><head><title>Tiny</title></head><body><p>Just <a href="/x">one link</a></p><script>bad()</script></body></html>',
      url: 'https://example.com/page',
      title: 'Tiny page',
    }, capturedAt)

    expect(result.title).toBe('Tiny')
    expect(result.markdown).toContain('# Tiny\n\nJust [one link](https://example.com/x)')
    expect(result.markdown).not.toContain('bad()')
  })

  it('never runs page scripts while parsing', () => {
    const marker = globalThis as { __pageScriptRan?: boolean }
    convertPageToMarkdown({
      html: '<html><body><p>Hello world</p><script>globalThis.__pageScriptRan = true</script><img src="x" onerror="globalThis.__pageScriptRan = true"></body></html>',
      url: 'https://example.com/',
      title: 'Hello',
    }, capturedAt)

    expect(marker.__pageScriptRan).toBeUndefined()
  })

  it('throws EmptyPageError when there is no text to convert', () => {
    expect(() => convertPageToMarkdown({
      html: '<html><body><script>x()</script></body></html>',
      url: 'https://example.com/',
      title: 'Empty',
    }, capturedAt)).toThrow(EmptyPageError)
  })

  it('uses the URL as the title when the page has none and flags truncation', () => {
    const result = convertPageToMarkdown({
      html: '<html><body><p>Some text</p></body></html>',
      url: 'https://example.com/untitled',
      title: '',
      truncated: true,
    }, capturedAt)

    expect(result.title).toBe('https://example.com/untitled')
    expect(result.markdown).toContain('truncated: true')
  })

  it('extracts Chinese articles without keeping navigation or footer', () => {
    const paragraph = '这一版加入了把标签页复制为 Markdown 的能力，正文提取基于 Readability，转换基于 Turndown，整条链路都在本地完成，不发任何网络请求。'
    const result = convertPageToMarkdown({
      html: `<html><head><title>发布说明 · 示例博客</title><meta property="og:site_name" content="示例博客"></head><body>
        <nav><a href="/">首页</a> <a href="/about">关于</a></nav>
        <article><h1>发布说明</h1><p>${paragraph}</p><p>${paragraph}</p><p>${paragraph}</p></article>
        <footer>版权所有 页脚文字</footer></body></html>`,
      url: 'https://example.com/blog/post',
      title: '发布说明 · 示例博客',
    }, capturedAt)

    expect(result.extracted).toBe(true)
    expect(result.markdown).toContain('site: "示例博客"')
    expect(result.markdown).toContain(paragraph)
    expect(result.markdown).not.toContain('首页')
    expect(result.markdown).not.toContain('页脚文字')
  })


  it('resolves relative links against the page base href', () => {
    const result = convertPageToMarkdown({
      html: '<html><head><base href="/docs/v2/"></head><body><p>See <a href="intro.html">intro</a> and <img src="a.png" alt="pic"></p></body></html>',
      url: 'https://example.com/blog/post',
      title: 'Docs',
    }, capturedAt)

    expect(result.markdown).toContain('[intro](https://example.com/docs/v2/intro.html)')
    expect(result.markdown).toContain('![pic](https://example.com/docs/v2/a.png)')
  })

})
