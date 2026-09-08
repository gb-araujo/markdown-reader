/** Shared types across main, preload and renderer processes. */

export type DocumentKind = 'markdown' | 'code' | 'text'

export interface FileInfo {
  path: string
  name: string
  size: number
  modifiedAt: number
}

export interface DocumentContent {
  info: FileInfo
  content: string
  kind: DocumentKind
  /** Language id for syntax highlighting when kind === 'code' */
  language: string | null
}

export interface FileReadError {
  code: 'NOT_FOUND' | 'ACCESS_DENIED' | 'TOO_LARGE' | 'NOT_A_FILE' | 'UNSUPPORTED' | 'UNKNOWN'
  message: string
  path: string
}

export type FileReadResult =
  | { ok: true; doc: DocumentContent }
  | { ok: false; error: FileReadError }

/** Result of writing a task-list checkbox back to a Markdown file. */
export type TaskWriteResult =
  | { ok: true; content: string; size: number; modifiedAt: number }
  | { ok: false; error: string }

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: TreeNode[]
}

export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  theme: ThemePreference
  sidebarWidth: number
  sidebarVisible: boolean
  defaultZoom: number
}

export interface SessionTab {
  path: string
  zoom: number
}

export interface SessionState {
  tabs: SessionTab[]
  activeTabPath: string | null
  folderPath: string | null
}

export interface Bookmark {
  id: string
  path: string
  /** Document display name, kept so bookmarks render without opening the file. */
  fileName: string
  /** Heading id the bookmark points at, or null for the top of the document. */
  headingId: string | null
  label: string
  createdAt: number
}

export interface PersistedState {
  settings: Settings
  recentFiles: RecentFile[]
  bookmarks: Bookmark[]
  /** Reading position (scrollTop in unzoomed px) per absolute file path */
  readingPositions: Record<string, number>
  session: SessionState
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  sidebarWidth: 260,
  sidebarVisible: true,
  defaultZoom: 100
}

export const DEFAULT_STATE: PersistedState = {
  settings: DEFAULT_SETTINGS,
  recentFiles: [],
  bookmarks: [],
  readingPositions: {},
  session: { tabs: [], activeTabPath: null, folderPath: null }
}

/** Commands sent from the native application menu to the renderer. */
export type MenuCommand =
  | 'open-file'
  | 'open-folder'
  | 'close-tab'
  | 'find'
  | 'print'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'toggle-sidebar'
  | 'toggle-theme'
  | 'next-tab'
  | 'prev-tab'
  | 'toggle-bookmark'
  | 'export-pdf'

export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd']

export const CODE_EXTENSIONS: Record<string, string> = {
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  ini: 'ini',
  conf: 'ini',
  config: 'xml',
  toml: 'ini'
}

export const TEXT_EXTENSIONS = ['txt', 'log', 'csv']

export const SUPPORTED_EXTENSIONS = [
  ...MARKDOWN_EXTENSIONS,
  ...Object.keys(CODE_EXTENSIONS),
  ...TEXT_EXTENSIONS
]

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB safety limit

export function extensionOf(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function kindForExtension(ext: string): { kind: DocumentKind; language: string | null } | null {
  if (MARKDOWN_EXTENSIONS.includes(ext)) return { kind: 'markdown', language: null }
  if (ext in CODE_EXTENSIONS) return { kind: 'code', language: CODE_EXTENSIONS[ext] }
  if (TEXT_EXTENSIONS.includes(ext)) return { kind: 'text', language: null }
  return null
}
