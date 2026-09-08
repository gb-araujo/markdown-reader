import { describe, it, expect, beforeEach } from 'vitest'
import {
  compareCells,
  cycleSort,
  markSortableTables,
  nextDirection,
  sortTable,
  sortValue
} from '../../src/renderer/src/core/tables'

function makeTable(headers: string[], rows: string[][]): HTMLTableElement {
  const container = document.createElement('div')
  container.innerHTML =
    '<table><thead><tr>' +
    headers.map((h) => `<th>${h}</th>`).join('') +
    '</tr></thead><tbody>' +
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
    '</tbody></table>'
  return container.querySelector('table')!
}

function column(table: HTMLTableElement, index: number): string[] {
  return Array.from(table.tBodies[0].rows).map((r) => r.cells[index].textContent ?? '')
}

describe('sortValue', () => {
  it('reads plain and formatted numbers as numbers', () => {
    expect(sortValue('42')).toBe(42)
    expect(sortValue(' -3.5 ')).toBe(-3.5)
    expect(sortValue('1,250')).toBe(1250)
    expect(sortValue('$1,250.75')).toBe(1250.75)
    expect(sortValue('87%')).toBe(87)
    expect(sortValue('(200)')).toBe(-200)
  })

  it('keeps mixed content as text', () => {
    expect(sortValue('v1.2.3')).toBe('v1.2.3')
    expect(sortValue('12 apples')).toBe('12 apples')
    expect(sortValue('')).toBe('')
  })
})

describe('compareCells', () => {
  it('compares numerically when both cells are numbers', () => {
    expect(compareCells('9', '10')).toBeLessThan(0)
  })

  it('compares text case-insensitively', () => {
    expect(compareCells('apple', 'Banana')).toBeLessThan(0)
  })

  it('sorts empty cells last in either direction', () => {
    expect(compareCells('', 'a')).toBeGreaterThan(0)
    expect(compareCells('a', '')).toBeLessThan(0)
    expect(compareCells('', '')).toBe(0)
  })
})

describe('nextDirection', () => {
  it('cycles none → asc → desc → none', () => {
    expect(nextDirection('none')).toBe('asc')
    expect(nextDirection('asc')).toBe('desc')
    expect(nextDirection('desc')).toBe('none')
  })
})

describe('sortTable', () => {
  let table: HTMLTableElement

  beforeEach(() => {
    table = makeTable(
      ['Name', 'Score'],
      [
        ['Carol', '9'],
        ['alice', '10'],
        ['Bob', '2']
      ]
    )
  })

  it('sorts text ascending and descending', () => {
    sortTable(table, 0, 'asc')
    expect(column(table, 0)).toEqual(['alice', 'Bob', 'Carol'])
    sortTable(table, 0, 'desc')
    expect(column(table, 0)).toEqual(['Carol', 'Bob', 'alice'])
  })

  it('sorts numeric columns by value, not by string', () => {
    sortTable(table, 1, 'asc')
    expect(column(table, 1)).toEqual(['2', '9', '10'])
  })

  it('restores the original order for direction "none"', () => {
    sortTable(table, 1, 'asc')
    sortTable(table, 1, 'none')
    expect(column(table, 0)).toEqual(['Carol', 'alice', 'Bob'])
  })

  it('marks the sorted header and clears the others', () => {
    sortTable(table, 1, 'desc')
    const headers = table.tHead!.rows[0].cells
    expect(headers[1].getAttribute('data-sort')).toBe('desc')
    expect(headers[0].hasAttribute('data-sort')).toBe(false)
    sortTable(table, 0, 'asc')
    expect(headers[0].getAttribute('data-sort')).toBe('asc')
    expect(headers[1].hasAttribute('data-sort')).toBe(false)
  })

  it('keeps ties in their original order', () => {
    const ties = makeTable(
      ['Name', 'Group'],
      [
        ['first', 'a'],
        ['second', 'a'],
        ['third', 'a']
      ]
    )
    sortTable(ties, 1, 'asc')
    expect(column(ties, 0)).toEqual(['first', 'second', 'third'])
  })
})

describe('cycleSort', () => {
  it('advances the column through the three states', () => {
    const table = makeTable(
      ['N'],
      [['3'], ['1'], ['2']]
    )
    const header = table.tHead!.rows[0].cells[0]
    cycleSort(header)
    expect(column(table, 0)).toEqual(['1', '2', '3'])
    cycleSort(header)
    expect(column(table, 0)).toEqual(['3', '2', '1'])
    cycleSort(header)
    expect(column(table, 0)).toEqual(['3', '1', '2'])
  })
})

describe('markSortableTables', () => {
  it('marks tables with a header and more than one row', () => {
    const container = document.createElement('div')
    container.appendChild(makeTable(['A'], [['1'], ['2']]))
    container.appendChild(makeTable(['A'], [['1']]))
    markSortableTables(container)
    const tables = container.querySelectorAll('table')
    expect(tables[0].classList.contains('sortable')).toBe(true)
    expect(tables[1].classList.contains('sortable')).toBe(false)
  })
})
