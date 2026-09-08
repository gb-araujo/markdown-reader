import { create } from 'zustand'
import type {
  Bookmark,
  DocumentContent,
  FileReadError,
  RecentFile,
  Settings,
  ThemePreference,
  TreeNode
} from '../../shared/types'
import { renderMarkdown, type TocItem } from './core/markdown'
import { renderCodeDocument } from './core/codeview'
import type { TaskItem } from './core/tasklist'
import { lineAt } from '../../shared/tasks'

export const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 175, 200]

export interface LightboxImage {
  /** doc-asset: URL used to display the image. */
  url: string
  /** Absolute file path, for copy/save/reveal actions. */
  path: string
  alt: string
}

export function effectiveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export interface Tab {
  id: string
  path: string
  name: string
  doc: DocumentContent | null
  error: FileReadError | null
  html: string
  toc: TocItem[]
  /** Task-list checkboxes in the document, kept in sync as they are toggled. */
  tasks: TaskItem[]
  zoom: number
  /** Last known scrollTop, kept when switching tabs. */
  scrollTop: number
  loading: boolean
}

export type SidebarPanel = 'files' | 'toc' | 'recents' | 'bookmarks'

/** Transient message shown to the user, e.g. when a task write fails. */
export interface Notice {
  text: string
  kind: 'error' | 'info'
}

interface AppState {
  tabs: Tab[]
  activeTabId: string | null
  folderPath: string | null
  folderTree: TreeNode | null
  recents: RecentFile[]
  bookmarks: Bookmark[]
  settings: Settings
  readingPositions: Record<string, number>
  searchOpen: boolean
  sidebarPanel: SidebarPanel
  activeHeadingId: string | null
  lightbox: LightboxImage | null
  notice: Notice | null
  initialized: boolean

  init: () => Promise<void>
  openPath: (path: string, opts?: { anchor?: string }) => Promise<void>
  openPaths: (paths: string[]) => Promise<void>
  openFileDialog: () => Promise<void>
  openFolder: (path?: string) => Promise<void>
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  activateTab: (id: string) => void
  cycleTab: (delta: number) => void
  setZoom: (zoom: number) => void
  zoomBy: (direction: 1 | -1) => void
  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setSidebarPanel: (panel: SidebarPanel) => void
  setSearchOpen: (open: boolean) => void
  setActiveHeading: (id: string | null) => void
  noteScroll: (tabId: string, scrollTop: number) => void
  refreshFolder: () => Promise<void>
  toggleBookmark: () => void
  removeBookmark: (id: string) => void
  goToBookmark: (bookmark: Bookmark) => void
  isCurrentBookmarked: () => boolean
  exportPdf: () => Promise<void>
  openLightbox: (image: LightboxImage) => void
  closeLightbox: () => void
  toggleTask: (tabId: string, line: number, checked: boolean) => Promise<boolean>
  setNotice: (notice: Notice | null) => void
}

let nextTabId = 1
/** Anchor to jump to once the freshly opened document mounts. */
export const pendingAnchors = new Map<string, string>()

function buildTabContent(doc: DocumentContent): { html: string; toc: TocItem[]; tasks: TaskItem[] } {
  if (doc.kind === 'markdown') {
    return renderMarkdown(doc.content)
  }
  return { html: renderCodeDocument(doc.content, doc.language), toc: [], tasks: [] }
}

export const useApp = create<AppState>((set, get) => {
  function persistSession(): void {
    const { tabs, activeTabId, folderPath } = get()
    const active = tabs.find((t) => t.id === activeTabId)
    void window.api.updateState({
      session: {
        tabs: tabs.map((t) => ({ path: t.path, zoom: t.zoom })),
        activeTabPath: active?.path ?? null,
        folderPath
      }
    })
  }

  function persistSettings(partial: Partial<Settings>): void {
    const settings = { ...get().settings, ...partial }
    set({ settings })
    void window.api.updateState({ settings })
  }

  function persistBookmarks(bookmarks: Bookmark[]): void {
    set({ bookmarks })
    window.api.setBookmarks(bookmarks)
  }

  return {
    tabs: [],
    activeTabId: null,
    folderPath: null,
    folderTree: null,
    recents: [],
    bookmarks: [],
    settings: { theme: 'system', sidebarWidth: 260, sidebarVisible: true, defaultZoom: 100 },
    readingPositions: {},
    searchOpen: false,
    sidebarPanel: 'files',
    activeHeadingId: null,
    lightbox: null,
    notice: null,
    initialized: false,

    init: async () => {
      const state = await window.api.getState()
      set({
        settings: state.settings,
        recents: state.recentFiles,
        bookmarks: state.bookmarks ?? [],
        readingPositions: state.readingPositions,
        initialized: true
      })
      if (state.session.folderPath) {
        await get().openFolder(state.session.folderPath)
      }
      for (const tab of state.session.tabs) {
        await get().openPath(tab.path)
        const opened = get().tabs.find((t) => t.path === tab.path)
        if (opened) {
          set({
            tabs: get().tabs.map((t) => (t.id === opened.id ? { ...t, zoom: tab.zoom } : t))
          })
        }
      }
      const activePath = state.session.activeTabPath
      if (activePath) {
        const tab = get().tabs.find((t) => t.path === activePath)
        if (tab) set({ activeTabId: tab.id })
      }
    },

    openPath: async (path, opts) => {
      const existing = get().tabs.find((t) => t.path === path)
      if (existing) {
        set({ activeTabId: existing.id })
        if (opts?.anchor) pendingAnchors.set(existing.id, opts.anchor)
        persistSession()
        return
      }
      const id = `tab-${nextTabId++}`
      const name = path.split(/[\\/]/).pop() ?? path
      const tab: Tab = {
        id,
        path,
        name,
        doc: null,
        error: null,
        html: '',
        toc: [],
        tasks: [],
        zoom: get().settings.defaultZoom,
        scrollTop: 0,
        loading: true
      }
      set({ tabs: [...get().tabs, tab], activeTabId: id })
      if (opts?.anchor) pendingAnchors.set(id, opts.anchor)

      const result = await window.api.readFile(path)
      set({
        tabs: get().tabs.map((t) => {
          if (t.id !== id) return t
          if (result.ok) {
            const { html, toc, tasks } = buildTabContent(result.doc)
            return { ...t, doc: result.doc, html, toc, tasks, loading: false }
          }
          return { ...t, error: result.error, loading: false }
        })
      })
      if (result.ok) {
        window.api.addRecentFile(path)
        const rest = get().recents.filter((r) => r.path !== path)
        set({ recents: [{ path, name, openedAt: Date.now() }, ...rest].slice(0, 30) })
      }
      persistSession()
    },

    openPaths: async (paths) => {
      for (const p of paths) await get().openPath(p)
    },

    openFileDialog: async () => {
      const paths = await window.api.openFileDialog()
      await get().openPaths(paths)
    },

    openFolder: async (path) => {
      const folderPath = path ?? (await window.api.openFolderDialog())
      if (!folderPath) return
      const tree = await window.api.scanFolder(folderPath)
      if (tree) {
        set({ folderPath, folderTree: tree, sidebarPanel: 'files' })
        persistSession()
      }
    },

    refreshFolder: async () => {
      const { folderPath } = get()
      if (!folderPath) return
      const tree = await window.api.scanFolder(folderPath)
      if (tree) set({ folderTree: tree })
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get()
      const idx = tabs.findIndex((t) => t.id === id)
      if (idx === -1) return
      const remaining = tabs.filter((t) => t.id !== id)
      let nextActive = activeTabId
      if (activeTabId === id) {
        const neighbor = remaining[Math.min(idx, remaining.length - 1)]
        nextActive = neighbor?.id ?? null
      }
      set({ tabs: remaining, activeTabId: nextActive })
      persistSession()
    },

    closeOtherTabs: (id) => {
      const tab = get().tabs.find((t) => t.id === id)
      if (!tab) return
      set({ tabs: [tab], activeTabId: id })
      persistSession()
    },

    activateTab: (id) => {
      if (get().tabs.some((t) => t.id === id)) {
        set({ activeTabId: id })
        persistSession()
      }
    },

    cycleTab: (delta) => {
      const { tabs, activeTabId } = get()
      if (tabs.length < 2) return
      const idx = tabs.findIndex((t) => t.id === activeTabId)
      const next = tabs[(idx + delta + tabs.length) % tabs.length]
      set({ activeTabId: next.id })
      persistSession()
    },

    setZoom: (zoom) => {
      const { tabs, activeTabId } = get()
      const clamped = Math.min(200, Math.max(50, zoom))
      set({
        tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, zoom: clamped } : t))
      })
      persistSession()
    },

    zoomBy: (direction) => {
      const { tabs, activeTabId } = get()
      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab) return
      const next =
        direction === 1
          ? ZOOM_LEVELS.find((z) => z > tab.zoom)
          : [...ZOOM_LEVELS].reverse().find((z) => z < tab.zoom)
      if (next !== undefined) get().setZoom(next)
    },

    setTheme: (theme) => persistSettings({ theme }),

    toggleTheme: () => {
      const current = get().settings.theme
      const effective =
        current === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : current
      persistSettings({ theme: effective === 'dark' ? 'light' : 'dark' })
    },

    toggleSidebar: () => persistSettings({ sidebarVisible: !get().settings.sidebarVisible }),

    setSidebarWidth: (width) =>
      persistSettings({ sidebarWidth: Math.min(500, Math.max(160, width)) }),

    setSidebarPanel: (panel) => set({ sidebarPanel: panel }),

    setSearchOpen: (open) => set({ searchOpen: open }),

    setActiveHeading: (id) => {
      if (get().activeHeadingId !== id) set({ activeHeadingId: id })
    },

    noteScroll: (tabId, scrollTop) => {
      const tab = get().tabs.find((t) => t.id === tabId)
      if (!tab) return
      tab.scrollTop = scrollTop
      window.api.setReadingPosition(tab.path, scrollTop)
    },

    toggleBookmark: () => {
      const { tabs, activeTabId, activeHeadingId, bookmarks } = get()
      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab || !tab.doc) return
      // A bookmark targets the current active heading, or the top of the doc.
      const headingId = activeHeadingId
      const existing = bookmarks.find((b) => b.path === tab.path && b.headingId === headingId)
      if (existing) {
        persistBookmarks(bookmarks.filter((b) => b.id !== existing.id))
        return
      }
      const heading = tab.toc.find((h) => h.id === headingId)
      const label = heading?.text ?? (headingId ? headingId : 'Top of document')
      const bookmark: Bookmark = {
        id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        path: tab.path,
        fileName: tab.name,
        headingId,
        label,
        createdAt: Date.now()
      }
      persistBookmarks([bookmark, ...bookmarks])
    },

    removeBookmark: (id) => {
      persistBookmarks(get().bookmarks.filter((b) => b.id !== id))
    },

    goToBookmark: (bookmark) => {
      void get().openPath(
        bookmark.path,
        bookmark.headingId ? { anchor: bookmark.headingId } : undefined
      )
    },

    isCurrentBookmarked: () => {
      const { tabs, activeTabId, activeHeadingId, bookmarks } = get()
      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab) return false
      return bookmarks.some((b) => b.path === tab.path && b.headingId === activeHeadingId)
    },

    exportPdf: async () => {
      const { tabs, activeTabId } = get()
      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab) return
      await window.api.exportPdf(tab.name)
    },

    openLightbox: (image) => set({ lightbox: image }),

    closeLightbox: () => set({ lightbox: null }),

    /**
     * Write a task-list checkbox back to its source file. `tab.html` is left
     * untouched on purpose: the browser has already flipped the checkbox in the
     * DOM, and re-rendering would restart Mermaid diagrams and drop search
     * highlights for a change that is already on screen.
     */
    toggleTask: async (tabId, line, checked) => {
      const tab = get().tabs.find((t) => t.id === tabId)
      if (!tab?.doc || tab.doc.kind !== 'markdown') return false
      const expected = lineAt(tab.doc.content, line)
      if (expected === null) {
        get().setNotice({ kind: 'error', text: 'That task is no longer in the document.' })
        return false
      }

      const result = await window.api.toggleTask(tab.path, line, checked, expected)
      if (!result.ok) {
        get().setNotice({ kind: 'error', text: result.error })
        return false
      }
      set({
        tabs: get().tabs.map((t) =>
          t.id !== tabId || !t.doc
            ? t
            : {
                ...t,
                doc: {
                  ...t.doc,
                  content: result.content,
                  info: { ...t.doc.info, size: result.size, modifiedAt: result.modifiedAt }
                },
                tasks: t.tasks.map((task) => (task.line === line ? { ...task, checked } : task))
              }
        )
      })
      return true
    },

    setNotice: (notice) => set({ notice })
  }
})
