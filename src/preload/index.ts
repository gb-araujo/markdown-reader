import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { resolve, dirname } from 'path'
import type {
  Bookmark,
  FileReadResult,
  MenuCommand,
  PersistedState,
  TreeNode
} from '../shared/types'

interface OpResult {
  ok: boolean
  path?: string
  error?: string
}

const api = {
  openFileDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:open-file'),
  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-folder'),
  readFile: (path: string): Promise<FileReadResult> => ipcRenderer.invoke('file:read', path),
  scanFolder: (path: string): Promise<TreeNode | null> => ipcRenderer.invoke('folder:scan', path),

  getState: (): Promise<PersistedState> => ipcRenderer.invoke('state:get'),
  updateState: (partial: Partial<PersistedState>): Promise<PersistedState> =>
    ipcRenderer.invoke('state:update', partial),
  addRecentFile: (path: string): void => ipcRenderer.send('state:add-recent', path),
  setReadingPosition: (path: string, position: number): void =>
    ipcRenderer.send('state:set-position', path, position),
  setBookmarks: (bookmarks: Bookmark[]): void =>
    ipcRenderer.send('state:set-bookmarks', bookmarks),

  openExternal: (url: string): void => ipcRenderer.send('shell:open-external', url),
  showInFolder: (path: string): void => ipcRenderer.send('shell:show-in-folder', path),
  print: (): void => ipcRenderer.send('window:print'),
  exportPdf: (suggestedName: string): Promise<OpResult> =>
    ipcRenderer.invoke('window:export-pdf', suggestedName),
  copyImage: (path: string): Promise<OpResult> => ipcRenderer.invoke('image:copy', path),
  saveImage: (path: string): Promise<OpResult> => ipcRenderer.invoke('image:save', path),

  /** Resolve a relative link/image target against the directory of a document. */
  resolveRelative: (documentPath: string, relative: string): string =>
    resolve(dirname(documentPath), relative),

  /** Absolute path of a File dropped onto the window. */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  onMenuCommand: (callback: (command: MenuCommand) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, command: MenuCommand): void => callback(command)
    ipcRenderer.on('menu-command', listener)
    return () => ipcRenderer.removeListener('menu-command', listener)
  },

  onOpenPaths: (callback: (paths: string[]) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, paths: string[]): void => callback(paths)
    ipcRenderer.on('open-paths', listener)
    return () => ipcRenderer.removeListener('open-paths', listener)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
