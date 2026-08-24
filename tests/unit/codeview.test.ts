import { describe, it, expect } from 'vitest'
import { renderCodeDocument } from '../../src/renderer/src/core/codeview'

describe('renderCodeDocument', () => {
  it('produces a gutter with one number per line', () => {
    const html = renderCodeDocument('a\nb\nc', null)
    const gutter = html.match(/code-view-gutter"[^>]*>([^<]*)</)?.[1] ?? ''
    expect(gutter.trim().split('\n')).toEqual(['1', '2', '3'])
  })

  it('normalizes CRLF line endings for the gutter', () => {
    const html = renderCodeDocument('a\r\nb\r\nc', null)
    const gutter = html.match(/code-view-gutter"[^>]*>([^<]*)</)?.[1] ?? ''
    expect(gutter.trim().split('\n')).toEqual(['1', '2', '3'])
  })

  it('escapes HTML in unhighlighted content', () => {
    const html = renderCodeDocument('<script>alert(1)</script>', null)
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('highlights known languages', () => {
    const html = renderCodeDocument('{"a": 1}', 'json')
    expect(html).toContain('hljs-')
  })

  it('handles empty content as a single line', () => {
    const html = renderCodeDocument('', null)
    const gutter = html.match(/code-view-gutter"[^>]*>([^<]*)</)?.[1] ?? ''
    expect(gutter.trim()).toBe('1')
  })
})
