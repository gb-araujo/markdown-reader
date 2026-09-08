import { describe, it, expect } from 'vitest'
import { isTaskLine, lineAt, setTaskLineState, toggleTaskInSource } from '../../src/shared/tasks'

describe('isTaskLine', () => {
  it('recognises bullet and ordered task items', () => {
    expect(isTaskLine('- [ ] todo')).toBe(true)
    expect(isTaskLine('* [x] done')).toBe(true)
    expect(isTaskLine('+ [X] done')).toBe(true)
    expect(isTaskLine('  - [ ] nested')).toBe(true)
    expect(isTaskLine('1. [ ] first')).toBe(true)
    expect(isTaskLine('2) [x] second')).toBe(true)
  })

  it('accepts an item with no text after the checkbox', () => {
    expect(isTaskLine('- [ ]')).toBe(true)
  })

  it('rejects lines that only look like task items', () => {
    expect(isTaskLine('- [y] wrong marker')).toBe(false)
    expect(isTaskLine('[ ] no list marker')).toBe(false)
    expect(isTaskLine('- [ready] a link label')).toBe(false)
    expect(isTaskLine('- [x](https://example.com)')).toBe(false)
    expect(isTaskLine('plain text')).toBe(false)
  })
})

describe('setTaskLineState', () => {
  it('checks and unchecks in place', () => {
    expect(setTaskLineState('- [ ] todo', true)).toBe('- [x] todo')
    expect(setTaskLineState('- [x] done', false)).toBe('- [ ] done')
  })

  it('normalises an uppercase marker when toggled', () => {
    expect(setTaskLineState('- [X] done', false)).toBe('- [ ] done')
  })

  it('preserves indentation, marker style and trailing content', () => {
    expect(setTaskLineState('   * [ ]  spaced  text  ', true)).toBe('   * [x]  spaced  text  ')
    expect(setTaskLineState('12. [ ] ordered', true)).toBe('12. [x] ordered')
  })

  it('returns null for a line without a checkbox', () => {
    expect(setTaskLineState('- plain item', true)).toBeNull()
  })
})

describe('lineAt', () => {
  it('returns lines by 0-based index', () => {
    expect(lineAt('a\nb\nc', 0)).toBe('a')
    expect(lineAt('a\nb\nc', 2)).toBe('c')
  })

  it('strips the CR of CRLF files', () => {
    expect(lineAt('a\r\nb\r\n', 1)).toBe('b')
  })

  it('returns null past the end', () => {
    expect(lineAt('a\nb', 5)).toBeNull()
    expect(lineAt('a\nb', -1)).toBeNull()
  })
})

describe('toggleTaskInSource', () => {
  const doc = '# Todo\n\n- [ ] first\n- [x] second\n\nDone.\n'

  it('toggles the addressed line only', () => {
    const result = toggleTaskInSource(doc, 2, true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.line).toBe('- [x] first')
    expect(result.source).toBe('# Todo\n\n- [x] first\n- [x] second\n\nDone.\n')
  })

  it('unchecks a checked item', () => {
    const result = toggleTaskInSource(doc, 3, false)
    expect(result.ok && result.source).toBe('# Todo\n\n- [ ] first\n- [ ] second\n\nDone.\n')
  })

  it('leaves CRLF line endings intact', () => {
    const crlf = '- [ ] a\r\n- [ ] b\r\n'
    const result = toggleTaskInSource(crlf, 1, true)
    expect(result.ok && result.source).toBe('- [ ] a\r\n- [x] b\r\n')
  })

  it('handles a task on the last line with no trailing newline', () => {
    const result = toggleTaskInSource('intro\n- [ ] last', 1, true)
    expect(result.ok && result.source).toBe('intro\n- [x] last')
  })

  it('rejects a line index past the end of the document', () => {
    expect(toggleTaskInSource(doc, 99, true)).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
  })

  it('rejects a line that is not a task item', () => {
    expect(toggleTaskInSource(doc, 0, true)).toEqual({ ok: false, reason: 'NOT_A_TASK' })
  })

  it('rejects the write when the line no longer matches what the caller saw', () => {
    expect(toggleTaskInSource(doc, 2, true, '- [ ] something else')).toEqual({
      ok: false,
      reason: 'STALE'
    })
  })

  it('accepts a matching expectation', () => {
    expect(toggleTaskInSource(doc, 2, true, '- [ ] first').ok).toBe(true)
  })

  it('compares the expectation without the CR of a CRLF file', () => {
    expect(toggleTaskInSource('- [ ] a\r\n', 0, true, '- [ ] a').ok).toBe(true)
  })

  it('keeps a byte-order mark at the start of the file', () => {
    const result = toggleTaskInSource('﻿- [ ] a\n', 0, true)
    expect(result.ok && result.source).toBe('﻿- [x] a\n')
  })
})
