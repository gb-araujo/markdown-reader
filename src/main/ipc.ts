import { BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from 'electron'
import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { readDocument, scanFolder } from './files'
import { store } from './store'
import {
  SUPPORTED_EXTENSIONS,
  type Bookmark,
  type PersistedState
} from '../shared/types'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dialog:open-file', async () => {
    const win = getWindow()
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: [...SUPPORTED_EXTENSIONS] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:open-folder', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('file:read', (_e, filePath: string) => readDocument(filePath))

  ipcMain.handle('folder:scan', (_e, folderPath: string) => scanFolder(folderPath))

  ipcMain.handle('state:get', () => store.get())

  ipcMain.handle('state:update', (_e, partial: Partial<PersistedState>) => store.update(partial))

  ipcMain.on('state:add-recent', (_e, path: string) => {
    store.addRecentFile(path, basename(path))
  })

  ipcMain.on('state:set-position', (_e, path: string, position: number) => {
    store.setReadingPosition(path, position)
  })

  ipcMain.on('shell:open-external', (_e, url: string) => {
    // Only allow safe protocols to leave the app.
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url)
  })

  ipcMain.on('shell:show-in-folder', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.on('state:set-bookmarks', (_e, bookmarks: Bookmark[]) => {
    store.setBookmarks(bookmarks)
  })

  ipcMain.on('window:print', () => {
    getWindow()?.webContents.print({ printBackground: false })
  })

  ipcMain.handle('window:export-pdf', async (_e, suggestedName: string) => {
    const win = getWindow()
    if (!win) return { ok: false, error: 'No window.' }
    const result = await dialog.showSaveDialog(win, {
      defaultPath: suggestedName.replace(/\.[^.]+$/, '') + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, error: 'canceled' }
    try {
      const data = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'default' }
      })
      await fs.writeFile(result.filePath, data)
      return { ok: true, path: result.filePath }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('image:copy', async (_e, filePath: string) => {
    try {
      const img = nativeImage.createFromPath(filePath)
      if (img.isEmpty()) {
        // SVG and some formats can't be decoded; fall back to copying the path.
        clipboard.writeText(filePath)
        return { ok: false, error: 'Format not copyable as bitmap; copied path instead.' }
      }
      clipboard.writeImage(img)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('image:save', async (_e, filePath: string) => {
    const win = getWindow()
    if (!win) return { ok: false, error: 'No window.' }
    const ext = extname(filePath).replace('.', '') || 'png'
    const result = await dialog.showSaveDialog(win, {
      defaultPath: basename(filePath),
      filters: [{ name: 'Image', extensions: [ext] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, error: 'canceled' }
    try {
      await fs.copyFile(filePath, result.filePath)
      return { ok: true, path: result.filePath }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}
