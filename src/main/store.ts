import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { DEFAULT_STATE, type PersistedState } from '../shared/types'

/**
 * Simple JSON file persistence in the app's userData folder.
 * Writes are debounced and atomic (write to temp file, then rename).
 */
export class Store {
  private state: PersistedState = structuredClone(DEFAULT_STATE)
  private filePath = ''
  private writeTimer: NodeJS.Timeout | null = null
  private loaded = false

  async load(): Promise<void> {
    this.filePath = join(app.getPath('userData'), 'state.json')
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      this.state = {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        settings: { ...DEFAULT_STATE.settings, ...(parsed.settings ?? {}) },
        session: { ...DEFAULT_STATE.session, ...(parsed.session ?? {}) }
      }
    } catch {
      // Missing or corrupted state file: start fresh, don't crash.
      this.state = structuredClone(DEFAULT_STATE)
    }
    this.loaded = true
  }

  get(): PersistedState {
    return this.state
  }

  update(partial: Partial<PersistedState>): PersistedState {
    this.state = {
      ...this.state,
      ...partial,
      settings: { ...this.state.settings, ...(partial.settings ?? {}) },
      session: { ...this.state.session, ...(partial.session ?? {}) }
    }
    this.scheduleWrite()
    return this.state
  }

  addRecentFile(path: string, name: string): void {
    const rest = this.state.recentFiles.filter((r) => r.path !== path)
    this.state.recentFiles = [{ path, name, openedAt: Date.now() }, ...rest].slice(0, 30)
    this.scheduleWrite()
  }

  setBookmarks(bookmarks: PersistedState['bookmarks']): void {
    this.state.bookmarks = bookmarks
    this.scheduleWrite()
  }

  setReadingPosition(path: string, position: number): void {
    this.state.readingPositions[path] = position
    // Cap the map so it doesn't grow forever
    const keys = Object.keys(this.state.readingPositions)
    if (keys.length > 500) {
      const known = new Set(this.state.recentFiles.map((r) => r.path))
      for (const k of keys) {
        if (!known.has(k)) delete this.state.readingPositions[k]
        if (Object.keys(this.state.readingPositions).length <= 500) break
      }
    }
    this.scheduleWrite()
  }

  private scheduleWrite(): void {
    if (!this.loaded) return
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => void this.flush(), 500)
  }

  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    if (!this.filePath) return
    try {
      const tmp = this.filePath + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf-8')
      await fs.rename(tmp, this.filePath)
    } catch (err) {
      console.error('[store] failed to persist state:', err)
    }
  }
}

export const store = new Store()
