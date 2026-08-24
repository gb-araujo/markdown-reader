import { useEffect, useRef, useState } from 'react'
import { useApp, type SidebarPanel } from '../store'
import type { TreeNode } from '../../../shared/types'

export default function Sidebar(): React.JSX.Element {
  const { settings, sidebarPanel, setSidebarPanel, setSidebarWidth } = useApp()
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const dragging = useRef(false)

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (dragging.current) setDragWidth(Math.min(500, Math.max(160, e.clientX)))
    }
    const onUp = (e: MouseEvent): void => {
      if (dragging.current) {
        dragging.current = false
        setDragWidth(null)
        setSidebarWidth(Math.min(500, Math.max(160, e.clientX)))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setSidebarWidth])

  const width = dragWidth ?? settings.sidebarWidth
  const panels: { id: SidebarPanel; label: string }[] = [
    { id: 'files', label: 'Files' },
    { id: 'toc', label: 'Contents' },
    { id: 'bookmarks', label: 'Marks' },
    { id: 'recents', label: 'Recents' }
  ]

  return (
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-tabs">
        {panels.map((p) => (
          <button
            key={p.id}
            className={`sidebar-tab${sidebarPanel === p.id ? ' active' : ''}`}
            onClick={() => setSidebarPanel(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="sidebar-content">
        {sidebarPanel === 'files' && <FilesPanel />}
        {sidebarPanel === 'toc' && <TocPanel />}
        {sidebarPanel === 'bookmarks' && <BookmarksPanel />}
        {sidebarPanel === 'recents' && <RecentsPanel />}
      </div>
      <div
        className="sidebar-resizer"
        onMouseDown={(e) => {
          e.preventDefault()
          dragging.current = true
        }}
      />
    </div>
  )
}

function FilesPanel(): React.JSX.Element {
  const { folderTree, openFolder } = useApp()
  if (!folderTree) {
    return (
      <div className="sidebar-empty">
        <p>No folder open.</p>
        <button className="tb-btn" onClick={() => void openFolder()}>
          Open Folder…
        </button>
      </div>
    )
  }
  return (
    <div className="file-tree">
      <div className="file-tree-root">{folderTree.name.toUpperCase()}</div>
      {(folderTree.children ?? []).map((node) => (
        <TreeNodeView key={node.path} node={node} depth={0} />
      ))}
    </div>
  )
}

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1)
  const { openPath, tabs, activeTabId } = useApp()
  const activePath = tabs.find((t) => t.id === activeTabId)?.path

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="tree-item tree-folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="tree-caret">{expanded ? '▾' : '▸'}</span> {node.name}
        </div>
        {expanded &&
          (node.children ?? []).map((child) => (
            <TreeNodeView key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    )
  }
  return (
    <div
      className={`tree-item tree-file${node.path === activePath ? ' active' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 + 14 }}
      title={node.path}
      onClick={() => void openPath(node.path)}
    >
      {node.name}
    </div>
  )
}

function TocPanel(): React.JSX.Element {
  const { tabs, activeTabId, activeHeadingId } = useApp()
  const tab = tabs.find((t) => t.id === activeTabId)

  if (!tab || tab.toc.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>{tab ? 'No headings in this document.' : 'No document open.'}</p>
      </div>
    )
  }
  const minLevel = Math.min(...tab.toc.map((h) => h.level))
  return (
    <div className="toc">
      <div className="file-tree-root">CONTENTS</div>
      {tab.toc.map((item, i) => (
        <div
          key={`${item.id}-${i}`}
          className={`toc-item${item.id === activeHeadingId ? ' active' : ''}`}
          style={{ paddingLeft: 8 + (item.level - minLevel) * 14 }}
          title={item.text}
          onClick={() => {
            document.dispatchEvent(new CustomEvent('goto-heading', { detail: item.id }))
          }}
        >
          {item.text || '(untitled)'}
        </div>
      ))}
    </div>
  )
}

function BookmarksPanel(): React.JSX.Element {
  const { bookmarks, goToBookmark, removeBookmark } = useApp()
  if (bookmarks.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>No bookmarks yet.</p>
        <p className="empty-hint">Press Ctrl+B while reading to add one.</p>
      </div>
    )
  }
  // Group bookmarks by document for a clean, scannable list.
  const groups = new Map<string, typeof bookmarks>()
  for (const b of bookmarks) {
    const list = groups.get(b.path) ?? []
    list.push(b)
    groups.set(b.path, list)
  }
  return (
    <div className="bookmarks">
      <div className="file-tree-root">BOOKMARKS</div>
      {[...groups.entries()].map(([path, marks]) => (
        <div key={path} className="bm-group">
          <div className="bm-file" title={path}>
            {marks[0].fileName}
          </div>
          {marks.map((b) => (
            <div key={b.id} className="bm-item" title={b.label}>
              <span className="bm-label" onClick={() => goToBookmark(b)}>
                {b.label}
              </span>
              <button
                className="bm-remove"
                title="Remove bookmark"
                onClick={() => removeBookmark(b.id)}
                aria-label="Remove bookmark"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function RecentsPanel(): React.JSX.Element {
  const { recents, openPath } = useApp()
  if (recents.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>No recent files.</p>
      </div>
    )
  }
  return (
    <div className="recents">
      <div className="file-tree-root">RECENT</div>
      {recents.map((r) => (
        <div
          key={r.path}
          className="recent-item"
          title={r.path}
          onClick={() => void openPath(r.path)}
        >
          <div className="recent-name">{r.name}</div>
          <div className="recent-time">{formatWhen(r.openedAt)}</div>
        </div>
      ))}
    </div>
  )
}

function formatWhen(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `Today, ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}
