import { useApp } from '../store'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function StatusBar(): React.JSX.Element {
  const { tabs, activeTabId, activeHeadingId } = useApp()
  const tab = tabs.find((t) => t.id === activeTabId)
  const heading = tab?.toc.find((h) => h.id === activeHeadingId)

  return (
    <div className="statusbar">
      <span className="status-left" title={tab?.path}>
        {tab ? tab.path : 'Ready'}
      </span>
      <span className="status-mid">{heading ? heading.text : ''}</span>
      <span className="status-right">
        {tab && <span>{tab.zoom}%</span>}
        {tab?.doc && <span>{formatSize(tab.doc.info.size)}</span>}
      </span>
    </div>
  )
}
