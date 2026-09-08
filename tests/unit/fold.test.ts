import { describe, it, expect, beforeEach } from 'vitest'
import { expandAll, headingLevel, revealElement, toggleSection } from '../../src/renderer/src/core/fold'

let body: HTMLElement

function heading(level: number, id: string): string {
  return `<h${level} id="${id}" class="md-heading"><button class="heading-fold" aria-expanded="true"></button>${id}</h${level}>`
}

beforeEach(() => {
  body = document.createElement('div')
  body.className = 'markdown-body'
  body.innerHTML =
    heading(1, 'title') +
    '<p id="intro">intro</p>' +
    heading(2, 'one') +
    '<p id="p1">one body</p>' +
    heading(3, 'one-a') +
    '<p id="p1a">one-a body</p>' +
    heading(2, 'two') +
    '<p id="p2">two body</p>'
  document.body.appendChild(body)
})

const el = (id: string): HTMLElement => body.querySelector(`#${id}`)!
const hidden = (id: string): boolean => el(id).hidden

describe('headingLevel', () => {
  it('reads the level from the tag name', () => {
    expect(headingLevel(el('one'))).toBe(2)
    expect(headingLevel(el('p1'))).toBe(0)
    expect(headingLevel(null)).toBe(0)
  })
})

describe('toggleSection', () => {
  it('hides everything until the next heading of the same level', () => {
    expect(toggleSection(el('one'))).toBe(true)
    expect(hidden('p1')).toBe(true)
    expect(hidden('one-a')).toBe(true)
    expect(hidden('p1a')).toBe(true)
    // The next h2 and its body stay visible.
    expect(hidden('two')).toBe(false)
    expect(hidden('p2')).toBe(false)
  })

  it('leaves the heading itself visible and marked collapsed', () => {
    toggleSection(el('one'))
    expect(el('one').hidden).toBe(false)
    expect(el('one').classList.contains('collapsed')).toBe(true)
    expect(el('one').querySelector('.heading-fold')!.getAttribute('aria-expanded')).toBe('false')
  })

  it('collapses a whole document from the top heading', () => {
    toggleSection(el('title'))
    for (const id of ['intro', 'one', 'p1', 'one-a', 'p1a', 'two', 'p2']) {
      expect(hidden(id)).toBe(true)
    }
  })

  it('restores visibility when toggled back', () => {
    toggleSection(el('one'))
    expect(toggleSection(el('one'))).toBe(false)
    expect(hidden('p1')).toBe(false)
    expect(hidden('one-a')).toBe(false)
    expect(hidden('p1a')).toBe(false)
    expect(el('one').classList.contains('collapsed')).toBe(false)
  })

  it('keeps a nested collapsed section folded when the outer one reopens', () => {
    toggleSection(el('one-a'))
    toggleSection(el('one'))
    toggleSection(el('one'))
    expect(hidden('p1')).toBe(false)
    expect(hidden('one-a')).toBe(false)
    // The inner section was collapsed by the user, so it stays that way.
    expect(hidden('p1a')).toBe(true)
    expect(el('one-a').classList.contains('collapsed')).toBe(true)
  })
})

describe('expandAll', () => {
  it('unfolds every section', () => {
    toggleSection(el('one-a'))
    toggleSection(el('one'))
    expandAll(body)
    for (const id of ['intro', 'one', 'p1', 'one-a', 'p1a', 'two', 'p2']) {
      expect(hidden(id)).toBe(false)
    }
    expect(body.querySelectorAll('.collapsed')).toHaveLength(0)
  })
})

describe('revealElement', () => {
  it('does nothing for content that is already visible', () => {
    revealElement(body, el('p2'))
    expect(hidden('p2')).toBe(false)
  })

  it('unfolds the section that hides the target', () => {
    toggleSection(el('one'))
    revealElement(body, el('p1'))
    expect(hidden('p1')).toBe(false)
    expect(el('one').classList.contains('collapsed')).toBe(false)
  })

  it('unfolds nested sections up to the target', () => {
    toggleSection(el('one-a'))
    toggleSection(el('one'))
    revealElement(body, el('p1a'))
    expect(hidden('p1a')).toBe(false)
    expect(el('one').classList.contains('collapsed')).toBe(false)
    expect(el('one-a').classList.contains('collapsed')).toBe(false)
  })
})
