/**
 * Click-to-sort for rendered markdown tables. Sorting is a view-only affordance:
 * it reorders rows in the DOM and never touches the source document.
 */

export type SortDirection = 'asc' | 'desc' | 'none'

/** Original row order, stashed on first sort so 'none' can restore it. */
const ORDER_ATTR = 'data-row-order'

export function nextDirection(current: SortDirection): SortDirection {
  return current === 'none' ? 'asc' : current === 'asc' ? 'desc' : 'none'
}

/**
 * Value used for comparison: a number when the whole cell reads as one
 * (thousands separators, currency symbols and a trailing % are tolerated),
 * otherwise the trimmed text.
 */
export function sortValue(text: string): number | string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const numeric = trimmed.replace(/[\s,$€£%]/g, '').replace(/^\((.*)\)$/, '-$1')
  if (numeric && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(numeric)) {
    return Number(numeric)
  }
  return trimmed
}

export function compareCells(a: string, b: string): number {
  const left = sortValue(a)
  const right = sortValue(b)
  if (typeof left === 'number' && typeof right === 'number') return left - right
  // Empty cells sort last regardless of direction flipping below.
  if (left === '') return right === '' ? 0 : 1
  if (right === '') return -1
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

export function sortTable(
  table: HTMLTableElement,
  columnIndex: number,
  direction: SortDirection
): void {
  const body = table.tBodies[0]
  if (!body) return
  const rows = Array.from(body.rows)
  if (rows.length < 2) return

  // Remember where each row started so 'none' can put them back.
  if (!rows[0].hasAttribute(ORDER_ATTR)) {
    rows.forEach((row, i) => row.setAttribute(ORDER_ATTR, String(i)))
  }

  if (direction === 'none') {
    rows.sort((a, b) => Number(a.getAttribute(ORDER_ATTR)) - Number(b.getAttribute(ORDER_ATTR)))
  } else {
    const sign = direction === 'asc' ? 1 : -1
    const cell = (row: HTMLTableRowElement): string => row.cells[columnIndex]?.textContent ?? ''
    // Compare on the original order for stability across repeated sorts.
    rows.sort((a, b) => {
      const result = compareCells(cell(a), cell(b))
      if (result !== 0) return result * sign
      return Number(a.getAttribute(ORDER_ATTR)) - Number(b.getAttribute(ORDER_ATTR))
    })
  }

  rows.forEach((row) => body.appendChild(row))

  const headers = table.tHead?.rows[0]?.cells
  if (headers) {
    Array.from(headers).forEach((header, i) => {
      if (i === columnIndex && direction !== 'none') header.setAttribute('data-sort', direction)
      else header.removeAttribute('data-sort')
    })
  }
}

/** Advance the sort state of the column owned by `header`. */
export function cycleSort(header: HTMLTableCellElement): void {
  const table = header.closest('table')
  const row = header.parentElement as HTMLTableRowElement | null
  if (!table || !row) return
  const current = (header.getAttribute('data-sort') as SortDirection | null) ?? 'none'
  sortTable(table, Array.from(row.cells).indexOf(header), nextDirection(current))
}

/** Mark tables that have a header and enough rows to be worth sorting. */
export function markSortableTables(container: HTMLElement): void {
  container.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const sortable = !!table.tHead?.rows.length && (table.tBodies[0]?.rows.length ?? 0) > 1
    table.classList.toggle('sortable', sortable)
  })
}
