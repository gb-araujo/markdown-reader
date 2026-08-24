import { app, BrowserWindow, nativeTheme, net, protocol, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { existsSync } from 'fs'
import { registerIpcHandlers } from './ipc'
import { buildMenu } from './menu'
import { store } from './store'
import { SUPPORTED_EXTENSIONS, extensionOf } from '../shared/types'

let mainWindow: BrowserWindow | null = null
/** Files passed on the command line (Explorer "Open with", file association). */
let pendingOpenPaths: string[] = collectPathArgs(process.argv)

function collectPathArgs(argv: string[]): string[] {
  return argv
    .slice(1)
    .filter((a) => !a.startsWith('-') && SUPPORTED_EXTENSIONS.includes(extensionOf(a)) && existsSync(a))
}

// Serve local images referenced by documents through a dedicated scheme so the
// renderer never gets direct file:// access.
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

protocol.registerSchemesAsPrivileged([
  { scheme: 'doc-asset', privileges: { standard: false, secure: true, supportFetchAPI: true } }
])

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 640,
    minHeight: 420,
    show: false,
    icon: join(__dirname, '../../build/icon.ico'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e20' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPaths.length > 0) {
      mainWindow?.webContents.send('open-paths', pendingOpenPaths)
      pendingOpenPaths = []
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const paths = collectPathArgs(argv)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      if (paths.length > 0) mainWindow.webContents.send('open-paths', paths)
    } else {
      pendingOpenPaths = paths
      createWindow()
    }
  })

  void app.whenReady().then(async () => {
    protocol.handle('doc-asset', (request) => {
      const filePath = decodeURIComponent(request.url.replace(/^doc-asset:\/*/i, ''))
      if (!IMAGE_EXTENSIONS.has(extensionOf(filePath))) {
        return new Response('Forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(filePath).toString())
    })

    await store.load()
    registerIpcHandlers(() => mainWindow)
    buildMenu(() => mainWindow)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  void store.flush().finally(() => app.quit())
})

app.on('before-quit', () => {
  void store.flush()
})
