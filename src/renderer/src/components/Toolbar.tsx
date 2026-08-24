import { useApp, ZOOM_LEVELS } from '../store'

export default function Toolbar(): React.JSX.Element {
  const {
    tabs,
    activeTabId,
    settings,
    openFileDialog,
    openFolder,
    zoomBy,
    setZoom,
    toggleSidebar,
    toggleTheme,
    setSearchOpen,
    toggleBookmark,
    isCurrentBookmarked,
    activeHeadingId,
    bookmarks
  } = useApp()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const zoom = activeTab?.zoom ?? 100
  // Recompute bookmark state as heading/bookmarks change.
  void activeHeadingId
  void bookmarks
  const bookmarked = activeTab ? isCurrentBookmarked() : false

  return (
    <div className="toolbar">
      <button
        className="tb-btn"
        title="Toggle sidebar (Ctrl+\)"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
      <div className="tb-sep" />
      <button className="tb-btn" title="Open file (Ctrl+O)" onClick={() => void openFileDialog()}>
        Open File
      </button>
      <button className="tb-btn" title="Open folder (Ctrl+Shift+O)" onClick={() => void openFolder()}>
        Open Folder
      </button>
      <div className="tb-sep" />
      <button
        className="tb-btn"
        title="Search (Ctrl+F)"
        disabled={!activeTab}
        onClick={() => setSearchOpen(true)}
      >
        🔍 Search
      </button>
      <button
        className={`tb-btn${bookmarked ? ' active' : ''}`}
        title="Add/remove bookmark (Ctrl+B)"
        disabled={!activeTab}
        onClick={toggleBookmark}
        aria-pressed={bookmarked}
      >
        {bookmarked ? '★' : '☆'} Bookmark
      </button>
      <div className="tb-spacer" />
      <div className="tb-zoom">
        <button className="tb-btn" title="Zoom out (Ctrl+-)" disabled={!activeTab} onClick={() => zoomBy(-1)}>
          −
        </button>
        <select
          className="tb-zoom-select"
          value={zoom}
          disabled={!activeTab}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom level"
        >
          {!ZOOM_LEVELS.includes(zoom) && <option value={zoom}>{zoom}%</option>}
          {ZOOM_LEVELS.map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
        </select>
        <button className="tb-btn" title="Zoom in (Ctrl+=)" disabled={!activeTab} onClick={() => zoomBy(1)}>
          +
        </button>
      </div>
      <div className="tb-sep" />
      <button
        className="tb-btn"
        title="Toggle light/dark theme (Ctrl+Shift+D)"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {settings.theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  )
}
