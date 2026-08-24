interface Props {
  onOpenFile: () => void
  onOpenFolder: () => void
}

export default function EmptyState({ onOpenFile, onOpenFolder }: Props): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-icon">📖</div>
      <h1>Markdown Reader</h1>
      <p>Open a Markdown file or a documentation folder to start reading.</p>
      <div className="empty-actions">
        <button className="empty-btn primary" onClick={onOpenFile}>
          Open File
        </button>
        <button className="empty-btn" onClick={onOpenFolder}>
          Open Folder
        </button>
      </div>
      <p className="empty-hint">…or drag files here</p>
    </div>
  )
}
