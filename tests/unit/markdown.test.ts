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

  it('adds a fold toggle to every heading', () => {
    const { html } = renderMarkdown('# Title\n\ntext')
    expect(html).toContain('class="md-heading"')
    expect(html).toContain('class="heading-fold"')
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

describe('task lists', () => {
  it('leaves checkboxes enabled so they can be clicked', () => {
    const { html } = renderMarkdown('- [ ] todo')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('disabled')
  })

  it('reflects the checked state of each item', () => {
    const { html, tasks } = renderMarkdown('- [ ] todo\n- [x] done\n- [X] also done')
    expect(tasks.map((t) => t.checked)).toEqual([false, true, true])
    expect(html.match(/checked/g)).toHaveLength(2)
  })

  it('maps each checkbox to its source line', () => {
    const source = '# Plan\n\n- [ ] first\n- [x] second\n\n## Later\n\n- [ ] third'
    const { tasks, html } = renderMarkdown(source)
    expect(tasks.map((t) => t.line)).toEqual([2, 3, 7])
    // The line each task reports really is its own line in the source.
    const lines = source.split('\n')
    for (const task of tasks) {
      expect(lines[task.line]).toContain(task.text)
    }
    expect(html).toContain('data-task-line="7"')
  })

  it('numbers tasks in document order', () => {
    const { html } = renderMarkdown('- [ ] a\n- [ ] b')
    expect(html).toContain('data-task-index="0"')
    expect(html).toContain('data-task-index="1"')
  })

  it('tracks lines through nested lists', () => {
    const { tasks } = renderMarkdown('- [ ] outer\n  - [ ] inner\n- [ ] last')
    expect(tasks.map((t) => t.line)).toEqual([0, 1, 2])
  })

  it('handles ordered task lists', () => {
    const { tasks } = renderMarkdown('1. [ ] first\n2. [x] second')
    expect(tasks.map((t) => t.line)).toEqual([0, 1])
    expect(tasks.map((t) => t.checked)).toEqual([false, true])
  })

  it('strips the marker from the visible text', () => {
    const { html, tasks } = renderMarkdown('- [x] ship it')
    expect(html).not.toContain('[x]')
    expect(tasks[0].text).toBe('ship it')
  })

  it('keeps inline formatting after the marker', () => {
    const { html } = renderMarkdown('- [ ] **bold** and `code`')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
  })

  it('classes the item and its list', () => {
    const { html } = renderMarkdown('- [ ] todo')
    expect(html).toContain('class="contains-task-list"')
    expect(html).toContain('class="task-list-item"')
  })

  it('ignores list items that only look like tasks', () => {
    const { html, tasks } = renderMarkdown('- [link](https://example.com)\n- [not a marker] text')
    expect(tasks).toEqual([])
    expect(html).not.toContain('type="checkbox"')
  })

  it('reports no tasks for a document without any', () => {
    expect(renderMarkdown('# Title\n\nJust prose.').tasks).toEqual([])
  })

  it('does not carry tasks over from a previous render', () => {
    renderMarkdown('- [ ] a\n- [ ] b')
    expect(renderMarkdown('no tasks here').tasks).toEqual([])
  })

  it('labels the checkbox with the task text', () => {
    const { html } = renderMarkdown('- [ ] say "hi"')
    expect(html).toContain('aria-label="say &quot;hi&quot;"')
  })

  it('keeps a usable label for text containing markup', () => {
    const { html } = renderMarkdown('- [ ] a <script>alert(1)</script> b')
    expect(html).not.toContain('<script')
    expect(html).toContain('aria-label="a scriptalert(1)/script b"')
  })

  it('truncates a very long label', () => {
    const { html } = renderMarkdown(`- [ ] ${'x'.repeat(300)}`)
    expect(html).toContain(`aria-label="${'x'.repeat(119)}…"`)
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

  it('keeps the data attributes that drive task toggling', () => {
    const out = sanitize('<input type="checkbox" data-task-line="3" data-task-index="0">')
    expect(out).toContain('data-task-line="3"')
    expect(out).toContain('data-task-index="0"')
  })
})
