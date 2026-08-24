import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { clearHighlights, highlightMatches, setActiveMatch, MAX_MATCHES } from '../core/search'

export default function SearchBar(): React.JSX.Element {
  const { setSearchOpen } = useApp()
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [current, setCurrent] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const marksRef = useRef<HTMLElement[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getContainer = (): HTMLElement | null => document.querySelector('.viewer')

  const runSearch = useCallback((q: string): void => {
    const container = getContainer()
    if (!container) return
    const marks = highlightMatches(container, q.trim())
    marksRef.current = marks
    setMatchCount(marks.length)
    setCurrent(marks.length > 0 ? 0 : -1)
    if (marks.length > 0) setActiveMatch(marks, 0)
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      const container = getContainer()
      if (container) clearHighlights(container)
    }
  }, [])

  const onChange = (value: string): void => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value), 200)
  }

  const step = (delta: number): void => {
    const marks = marksRef.current
    if (marks.length === 0) return
    const next = (current + delta + marks.length) % marks.length
    setCurrent(next)
    setActiveMatch(marks, next)
  }

  return (
    <div className="searchbar">
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="Search in document…"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') setSearchOpen(false)
        }}
      />
      <span className="search-count">
        {query.trim()
          ? matchCount > 0
            ? `${current + 1} of ${matchCount}${matchCount >= MAX_MATCHES ? '+' : ''}`
            : 'No results'
          : ''}
      </span>
      <button className="tb-btn" title="Previous (Shift+Enter)" disabled={matchCount === 0} onClick={() => step(-1)}>
        ↑
      </button>
      <button className="tb-btn" title="Next (Enter)" disabled={matchCount === 0} onClick={() => step(1)}>
        ↓
      </button>
      <button className="tb-btn" title="Close (Esc)" onClick={() => setSearchOpen(false)}>
        ×
      </button>
    </div>
  )
}
