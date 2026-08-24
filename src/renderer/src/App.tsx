import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from './store'
import Toolbar from './components/Toolbar'
import TabBar from './components/TabBar'
import Sidebar from './components/Sidebar'
import Viewer from './components/Viewer'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
import EmptyState from './components/EmptyState'
import Lightbox from './components/Lightbox'
import type { MenuCommand } from '../../shared/types'

export default function App(): React.JSX.Element {
  const {
    tabs,
    activeTabId,
    settings,
    init,
    initialized,
    openPaths,
    openFileDialog,
    openFolder,
    searchOpen
  } = useApp()
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  useEffect(() => {
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply theme to <html> and react to OS theme changes when in "system" mode.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const effective =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      document.documentElement.dataset.theme = effective
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])

  // Native menu commands.
  useEffect(() => {
    return window.api.onMenuCommand((command: MenuCommand) => {
      const state = useApp.getState()
      switch (command) {
        case 'open-file':
          void state.openFileDialog()
          break
        case 'open-folder':
          void state.openFolder()
          break
        case 'close-tab':
          if (state.activeTabId) state.closeTab(state.activeTabId)
          break
        case 'find':
          state.setSearchOpen(true)
          break
        case 'print':
          window.api.print()
          break
        case 'zoom-in':
          state.zoomBy(1)
          break
        case 'zoom-out':
          state.zoomBy(-1)
          break
        case 'zoom-reset':
          state.setZoom(100)
          break
        case 'toggle-sidebar':
          state.toggleSidebar()
          break
        case 'toggle-theme':
          state.toggleTheme()
          break
        case 'next-tab':
          state.cycleTab(1)
          break
        case 'prev-tab':
          state.cycleTab(-1)
          break
        case 'toggle-bookmark':
          state.toggleBookmark()
          break
        case 'export-pdf':
          void state.exportPdf()
          break
      }
    })
  }, [])

  // Files opened from Explorer / command line / second instance.
  useEffect(() => {
    return window.api.onOpenPaths((paths) => void openPaths(paths))
  }, [openPaths])

  // Keyboard shortcuts not covered by the native menu.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && useApp.getState().searchOpen) {
        useApp.getState().setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Drag & drop of files and folders.
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return
      const paths = files.map((f) => window.api.pathForFile(f)).filter(Boolean)
      const folders = paths.filter((p) => !/\.[^\\/.]+$/.test(p))
      const docs = paths.filter((p) => /\.[^\\/.]+$/.test(p))
      if (folders.length > 0) void openFolder(folders[0])
      if (docs.length > 0) void openPaths(docs)
    },
    [openFolder, openPaths]
  )

  if (!initialized) return <div className="app-loading" />

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current++
        setDragging(true)
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <Toolbar />
      {tabs.length > 0 && <TabBar />}
      <div className="app-body">
        {settings.sidebarVisible && <Sidebar />}
        <div className="viewer-area">
          {searchOpen && activeTab && <SearchBar key={activeTab.id} />}
          {activeTab ? (
            <Viewer key={activeTab.id} tab={activeTab} />
          ) : (
            <EmptyState onOpenFile={() => void openFileDialog()} onOpenFolder={() => void openFolder()} />
          )}
        </div>
      </div>
      <StatusBar />
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-box">Drop files or a folder to open</div>
        </div>
      )}
      <Lightbox />
    </div>
  )
}
