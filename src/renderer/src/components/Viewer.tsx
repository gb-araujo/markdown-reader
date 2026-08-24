import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp, pendingAnchors, effectiveTheme, type Tab } from '../store'
import { SUPPORTED_EXTENSIONS, extensionOf } from '../../../shared/types'
import { renderMermaidBlocks, resetMermaid } from '../core/mermaid'
import { parseStructured } from '../core/structured'
import JsonTree from './JsonTree'

export default function Viewer({ tab }: { tab: Tab }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { readingPositions, noteScroll, setActiveHeading, openPath, openLightbox, settings } = useApp()
  const theme = effectiveTheme(settings.theme)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restored = useRef(false)

  // Structured (JSON/YAML) documents can be shown as an interactive tree.
  const structured = useMemo(() => {
    if (tab.doc?.kind === 'code' && (tab.doc.language === 'json' || tab.doc.language === 'yaml')) {
      return parseStructured(tab.doc.content, tab.doc.language)
    }
    return null
  }, [tab.doc])
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree')
  const showTree = structured?.ok === true && viewMode === 'tree'

  // Restore scroll position (or jump to a pending anchor) once content is in.
  useEffect(() => {
    const el = containerRef.current
    if (!el || tab.loading || restored.current) return
    restored.current = true

    const anchor = pendingAnchors.get(tab.id)
    if (anchor) {
      pendingAnchors.delete(tab.id)
      requestAnimationFrame(() => scrollToHeading(el, anchor))
      return
    }
    const saved = tab.scrollTop || readingPositions[tab.path] || 0
    if (saved > 0) {
      requestAnimationFrame(() => {
        el.scrollTop = saved
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.loading])

  // Jump to a pending anchor when the tab is re-activated with one.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const anchor = pendingAnchors.get(tab.id)
    if (anchor && !tab.loading) {
      pendingAnchors.delete(tab.id)
      scrollToHeading(el, anchor)
    }
  })

  // TOC clicks.
  useEffect(() => {
    const handler = (e: Event): void => {
      const el = containerRef.current
      if (el) scrollToHeading(el, (e as CustomEvent<string>).detail)
    }
    document.addEventListener('goto-heading', handler)
    return () => document.removeEventListener('goto-heading', handler)
  }, [])

  // Resolve relative image paths through the doc-asset protocol.
  useEffect(() => {
    const el = containerRef.current
    if (!el || tab.loading) return
    el.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src')
      if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src)) return
      try {
        const abs = window.api.resolveRelative(tab.path, decodeURIComponent(src))
        img.src = `doc-asset:${encodeURIComponent(abs)}`
        img.alt = img.alt || 'image'
      } catch {
        // leave as-is; broken image icon will show
      }
    })
  }, [tab.loading, tab.path, tab.html])

  // Render Mermaid diagrams and re-render when the theme changes.
  useEffect(() => {
    const el = containerRef.current
    if (!el || tab.loading || tab.doc?.kind !== 'markdown') return
    resetMermaid(el)
    void renderMermaidBlocks(el, theme)
  }, [tab.loading, tab.html, tab.doc?.kind, theme])

  const onScroll = useCallback((): void => {
    const el = containerRef.current
    if (!el) return
    // Persist reading position (debounced).
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => noteScroll(tab.id, el.scrollTop), 400)
    // Track the heading currently at the top of the viewport.
    const headings = el.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    let current: string | null = null
    const threshold = el.scrollTop + 80
    for (const h of headings) {
      if (h.offsetTop <= threshold) current = h.id
      else break
    }
    setActiveHeading(current)
  }, [tab.id, noteScroll, setActiveHeading])

  // Flush pending scroll save when the tab unmounts (switch/close).
  useEffect(() => {
    return () => {
      const el = containerRef.current
      if (el) noteScroll(tab.id, el.scrollTop)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent): void => {
      const target = e.target as HTMLElement

      // Copy buttons on code blocks.
      if (target.classList.contains('code-copy')) {
        const code = target.closest('.code-block')?.querySelector('code')
        if (code) {
          void navigator.clipboard.writeText(code.textContent ?? '')
          target.textContent = 'Copied!'
          setTimeout(() => (target.textContent = 'Copy'), 1500)
        }
        return
      }

      // Images open in the lightbox (ignore images that failed to resolve).
      if (target.tagName === 'IMG' && !target.closest('a')) {
        const img = target as HTMLImageElement
        const url = img.getAttribute('src') ?? ''
        if (url.startsWith('doc-asset:')) {
          const path = decodeURIComponent(url.replace(/^doc-asset:/, ''))
          openLightbox({ url, path, alt: img.alt || 'image' })
        }
        return
      }

      const link = target.closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href) return
      e.preventDefault()

      if (href.startsWith('#')) {
        const el = containerRef.current
        if (el) scrollToHeading(el, decodeURIComponent(href.slice(1)))
        return
      }
      if (/^https?:|^mailto:/i.test(href)) {
        window.api.openExternal(href)
        return
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return // other schemes: ignore

      // Relative link: open supported documents in a new tab.
      const [rawPath, anchor] = href.split('#')
      if (!rawPath) return
      try {
        const abs = window.api.resolveRelative(tab.path, decodeURIComponent(rawPath))
        if (SUPPORTED_EXTENSIONS.includes(extensionOf(abs))) {
          void openPath(abs, anchor ? { anchor: decodeURIComponent(anchor) } : undefined)
        } else {
          window.api.showInFolder(abs)
        }
      } catch {
        // invalid path; ignore
      }
    },
    [tab.path, openPath, openLightbox]
  )

  const onKeyDown = useCallback((e: React.KeyboardEvent): void => {
    const el = containerRef.current
    if (!el) return
    if (e.key === 'Home' && !isEditable(e.target)) {
      el.scrollTop = 0
      e.preventDefault()
    } else if (e.key === 'End' && !isEditable(e.target)) {
      el.scrollTop = el.scrollHeight
      e.preventDefault()
    }
  }, [])

  if (tab.loading) {
    return <div className="viewer viewer-message">Loading…</div>
  }
  if (tab.error) {
    return (
      <div className="viewer viewer-message viewer-error">
        <h2>Could not open document</h2>
        <p>{tab.error.message}</p>
        <p className="viewer-error-path">{tab.error.path}</p>
      </div>
    )
  }

  const isMarkdown = tab.doc?.kind === 'markdown'
  return (
    <div
      ref={containerRef}
      className={`viewer${isMarkdown ? ' viewer-markdown' : ' viewer-code'}`}
      onScroll={onScroll}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      {structured?.ok && (
        <div className="view-toggle">
          <button
            className={`view-toggle-btn${viewMode === 'tree' ? ' active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            Tree
          </button>
          <button
            className={`view-toggle-btn${viewMode === 'raw' ? ' active' : ''}`}
            onClick={() => setViewMode('raw')}
          >
            Raw
          </button>
        </div>
      )}
      {showTree ? (
        <div className="code-body" style={{ zoom: tab.zoom / 100 }}>
          <JsonTree value={structured.value} />
        </div>
      ) : (
        <div
          className={isMarkdown ? 'markdown-body' : 'code-body'}
          style={{ zoom: tab.zoom / 100 }}
          dangerouslySetInnerHTML={{ __html: tab.html }}
        />
      )}
    </div>
  )
}

function scrollToHeading(container: HTMLElement, id: string): void {
  const target =
    container.querySelector(`[id="${CSS.escape(id)}"]`) ??
    container.querySelector(`[name="${CSS.escape(id)}"]`)
  if (target) {
    const top = (target as HTMLElement).offsetTop - 12
    container.scrollTop = Math.max(0, top)
  }
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
