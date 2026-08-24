import { describe, it, expect } from 'vitest'
import { renderMarkdown, sanitize } from '../../src/renderer/src/core/markdown'

describe('renderMarkdown', () => {
  it('renders basic formatting to HTML', () => {
    const { html } = renderMarkdown('This is **bold**, *italic* and ~~struck~~.')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<s>struck</s>')
  })

  it('builds a table of contents from headings with matching ids', () => {
    const src = '# Title\n\n## Install\n\n### Requirements\n\n## Usage'
    const { html, toc } = renderMarkdown(src)
    expect(toc).toEqual([
      { id: 'title', text: 'Title', level: 1 },
      { id: 'install', text: 'Install', level: 2 },
      { id: 'requirements', text: 'Requirements', level: 3 },
      { id: 'usage', text: 'Usage', level: 2 }
    ])
    // every toc id must exist in the rendered html
    for (const item of toc) {
      expect(html).toContain(`id="${item.id}"`)
    }
  })

  it('disambiguates duplicate heading ids', () => {
    const { toc } = renderMarkdown('# Notes\n\n# Notes')
    expect(toc.map((t) => t.id)).toEqual(['notes', 'notes-1'])
  })

  it('wraps fenced code with header and copy button', () => {
    const { html } = renderMarkdown('```js\nconst x = 1\n```')
    expect(html).toContain('class="code-block"')
    expect(html).toContain('class="code-copy"')
    expect(html).toContain('>js<')
  })

  it('renders tables', () => {
    const { html } = renderMarkdown('| A | B |\n| - | - |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
  })

  it('renders task lists as checkboxes', () => {
    const { html } = renderMarkdown('- [ ] todo\n- [x] done')
    expect(html).toContain('type="checkbox"')
  })

  it('handles empty input without throwing', () => {
    expect(() => renderMarkdown('')).not.toThrow()
    const { toc } = renderMarkdown('')
    expect(toc).toEqual([])
  })

  it('preserves unicode and accents in headings', () => {
    const { toc } = renderMarkdown('# Instalação e Configuração')
    expect(toc[0].text).toBe('Instalação e Configuração')
    expect(toc[0].id).toBe('instalacao-e-configuracao')
  })

  it('emits a mermaid placeholder for mermaid fences', () => {
    const { html } = renderMarkdown('```mermaid\ngraph TD; A-->B;\n```')
    expect(html).toContain('class="mermaid-block"')
    expect(html).toContain('data-processed="false"')
    expect(html).toContain('A--&gt;B') // source escaped inside .mermaid-source
    expect(html).not.toContain('class="code-block"')
  })

  it('renders inline math with KaTeX', () => {
    const { html } = renderMarkdown('Euler: $e^{i\\pi}+1=0$.')
    expect(html).toContain('katex')
  })

  it('renders block math with KaTeX', () => {
    const { html } = renderMarkdown('$$\\int_0^1 x\\,dx = \\tfrac12$$')
    expect(html).toContain('katex')
  })
})

describe('sanitize', () => {
  it('strips <script> tags', () => {
    expect(sanitize('<p>ok</p><script>alert(1)</script>')).not.toContain('<script')
  })

  it('removes event handler attributes', () => {
    const out = sanitize('<img src="x" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
  })

  it('does not emit javascript: links', () => {
    const out = renderMarkdown('[click](javascript:alert(1))').html
    // markdown-it refuses the unsafe target: no anchor with a javascript: href.
    expect(out).not.toMatch(/href\s*=\s*["']?\s*javascript:/i)
  })

  it('keeps safe links', () => {
    const out = renderMarkdown('[docs](https://example.com)').html
    expect(out).toContain('href="https://example.com"')
  })
})
