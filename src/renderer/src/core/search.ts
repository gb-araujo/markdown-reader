/**
 * In-document search: finds occurrences of a query inside a container's text
 * nodes and wraps them in <mark> elements for highlighting.
 */

export const MAX_MATCHES = 2000

export function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll('mark.search-hit')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

export function highlightMatches(container: HTMLElement, query: string): HTMLElement[] {
  clearHighlights(container)
  if (!query) return []
  const needle = query.toLowerCase()
  const marks: HTMLElement[] = []

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('mark.search-hit')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  // Collect nodes first: wrapping mutates the tree under the walker.
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  outer: for (const node of textNodes) {
    const text = node.data
    const haystack = text.toLowerCase()
    // Find all match offsets in this node.
    const offsets: number[] = []
    let idx = haystack.indexOf(needle)
    while (idx !== -1) {
      offsets.push(idx)
      idx = haystack.indexOf(needle, idx + needle.length)
    }
    // Wrap from last to first so earlier offsets stay valid.
    for (let i = offsets.length - 1; i >= 0; i--) {
      const start = offsets[i]
      const matchNode = (node as Text).splitText(start)
      matchNode.splitText(needle.length)
      const mark = document.createElement('mark')
      mark.className = 'search-hit'
      matchNode.parentNode?.replaceChild(mark, matchNode)
      mark.appendChild(matchNode)
      marks.push(mark)
      if (marks.length >= MAX_MATCHES) break outer
    }
  }

  // Wrapping happened bottom-up per node; restore document order.
  marks.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  )
  return marks
}

export function setActiveMatch(marks: HTMLElement[], index: number): void {
  marks.forEach((m, i) => m.classList.toggle('active', i === index))
  const active = marks[index]
  active?.scrollIntoView?.({ block: 'center', behavior: 'auto' })
}
