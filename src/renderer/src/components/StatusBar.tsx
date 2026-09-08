import { useApp } from '../store'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function StatusBar(): React.JSX.Element {
  const { tabs, activeTabId, activeHeadingId, notice } = useApp()
  const tab = tabs.find((t) => t.id === activeTabId)
  const heading = tab?.toc.find((h) => h.id === activeHeadingId)
  const tasks = tab?.tasks ?? []
  const done = tasks.filter((t) => t.checked).length

  return (
    <div className="statusbar">
      <span className="status-left" title={tab?.path}>
        {tab ? tab.path : 'Ready'}
      </span>
      <span className={`status-mid${notice ? ` status-notice ${notice.kind}` : ''}`}>
        {notice ? notice.text : heading ? heading.text : ''}
      </span>
      <span className="status-right">
        {tasks.length > 0 && (
          <span title={`${done} of ${tasks.length} tasks done`}>
            ☑ {done}/{tasks.length}
          </span>
        )}
        {tab && <span>{tab.zoom}%</span>}
        {tab?.doc && <span>{formatSize(tab.doc.info.size)}</span>}
      </span>
    </div>
  )
}
