import { describe, it, expect, beforeEach } from 'vitest'
import { highlightMatches, clearHighlights, setActiveMatch } from '../../src/renderer/src/core/search'

describe('search highlighting', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.innerHTML =
      '<p>The quick brown fox</p><p>jumps over the lazy dog. The end.</p>'
    document.body.appendChild(container)
  })

  it('wraps all case-insensitive matches', () => {
    const marks = highlightMatches(container, 'the')
    // "The", "the", "The" => 3 matches
    expect(marks.length).toBe(3)
    marks.forEach((m) => expect(m.tagName).toBe('MARK'))
  })

  it('returns matches in document order', () => {
    const marks = highlightMatches(container, 'the')
    for (let i = 1; i < marks.length; i++) {
      const rel = marks[i - 1].compareDocumentPosition(marks[i])
      expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('finds multiple matches within a single text node', () => {
    container.innerHTML = '<p>aaa</p>'
    const marks = highlightMatches(container, 'a')
    expect(marks.length).toBe(3)
  })

  it('returns nothing for an empty query', () => {
    expect(highlightMatches(container, '')).toEqual([])
  })

  it('returns nothing when there is no match', () => {
    expect(highlightMatches(container, 'zzz')).toEqual([])
  })

  it('clears previous highlights and restores text', () => {
    const original = container.textContent
    highlightMatches(container, 'the')
    clearHighlights(container)
    expect(container.querySelectorAll('mark').length).toBe(0)
    expect(container.textContent).toBe(original)
  })

  it('re-running search replaces old highlights', () => {
    highlightMatches(container, 'the')
    const marks = highlightMatches(container, 'fox')
    expect(marks.length).toBe(1)
    expect(container.querySelectorAll('mark').length).toBe(1)
  })

  it('marks the active match', () => {
    const marks = highlightMatches(container, 'the')
    setActiveMatch(marks, 1)
    expect(marks[1].classList.contains('active')).toBe(true)
    expect(marks[0].classList.contains('active')).toBe(false)
  })
})
