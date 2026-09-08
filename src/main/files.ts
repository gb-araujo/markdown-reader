import { promises as fs } from 'fs'
import { basename, join } from 'path'
import {
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_EXTENSIONS,
  extensionOf,
  kindForExtension,
  type FileReadResult,
  type TaskWriteResult,
  type TreeNode
} from '../shared/types'
import { toggleTaskInSource } from '../shared/tasks'

/** Read a document from disk with friendly, typed errors. */
export async function readDocument(filePath: string): Promise<FileReadResult> {
  const ext = extensionOf(filePath)
  const kindInfo = kindForExtension(ext)
  if (!kindInfo) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED',
        message: `Unsupported file type: .${ext || '?'}`,
        path: filePath
      }
    }
  }
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      return {
        ok: false,
        error: { code: 'NOT_A_FILE', message: 'The path is not a file.', path: filePath }
      }
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return {
        ok: false,
        error: {
          code: 'TOO_LARGE',
          message: `File is too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Limit is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
          path: filePath
        }
      }
    }
    const content = await fs.readFile(filePath, 'utf-8')
    return {
      ok: true,
      doc: {
        info: {
          path: filePath,
          name: basename(filePath),
          size: stat.size,
          modifiedAt: stat.mtimeMs
        },
        content,
        kind: kindInfo.kind,
        language: kindInfo.language
      }
    }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'File not found.', path: filePath }
      }
    }
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      return {
        ok: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied.', path: filePath }
      }
    }
    return {
      ok: false,
      error: { code: 'UNKNOWN', message: e.message ?? 'Unknown error reading file.', path: filePath }
    }
  }
}

const TASK_FAILURES: Record<string, string> = {
  OUT_OF_RANGE: 'That line no longer exists — the file changed on disk.',
  NOT_A_TASK: 'That line is no longer a task item — the file changed on disk.',
  STALE: 'The file changed on disk. Reopen it to see the current version.'
}

/**
 * Flip a task-list checkbox on disk. The file is re-read first and the target
 * line must still match `expected`, so an edit made outside the app is reported
 * rather than silently overwritten.
 */
export async function toggleTaskInFile(
  filePath: string,
  lineIndex: number,
  checked: boolean,
  expected: string
): Promise<TaskWriteResult> {
  if (kindForExtension(extensionOf(filePath))?.kind !== 'markdown') {
    return { ok: false, error: 'Only Markdown documents can be edited.' }
  }
  try {
    const current = await fs.readFile(filePath, 'utf-8')
    const outcome = toggleTaskInSource(current, lineIndex, checked, expected)
    if (!outcome.ok) {
      return { ok: false, error: TASK_FAILURES[outcome.reason] ?? 'Could not update the task.' }
    }
    await fs.writeFile(filePath, outcome.source, 'utf-8')
    const stat = await fs.stat(filePath)
    return { ok: true, content: outcome.source, size: stat.size, modifiedAt: stat.mtimeMs }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS') {
      return { ok: false, error: 'The file is read-only or access was denied.' }
    }
    if (e.code === 'ENOENT') return { ok: false, error: 'File not found.' }
    return { ok: false, error: e.message ?? 'Could not write the file.' }
  }
}

const IGNORED_FOLDERS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'out', '.next', 'bin', 'obj', '__pycache__'])
const MAX_TREE_DEPTH = 8
const MAX_TREE_ENTRIES = 5000

/**
 * Scan a folder for supported documents, returning a sorted tree.
 * Folders without any supported file (recursively) are pruned.
 */
export async function scanFolder(folderPath: string): Promise<TreeNode | null> {
  let count = 0

  async function walk(dir: string, depth: number): Promise<TreeNode[]> {
    if (depth > MAX_TREE_DEPTH || count > MAX_TREE_ENTRIES) return []
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const folders: TreeNode[] = []
    const files: TreeNode[] = []
    for (const entry of entries) {
      if (count > MAX_TREE_ENTRIES) break
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_FOLDERS.has(entry.name.toLowerCase()) || entry.name.startsWith('.')) continue
        const children = await walk(full, depth + 1)
        if (children.length > 0) {
          folders.push({ name: entry.name, path: full, type: 'folder', children })
          count++
        }
      } else if (entry.isFile()) {
        if (SUPPORTED_EXTENSIONS.includes(extensionOf(entry.name))) {
          files.push({ name: entry.name, path: full, type: 'file' })
          count++
        }
      }
    }
    const byName = (a: TreeNode, b: TreeNode): number =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    return [...folders.sort(byName), ...files.sort(byName)]
  }

  try {
    const stat = await fs.stat(folderPath)
    if (!stat.isDirectory()) return null
  } catch {
    return null
  }
  const children = await walk(folderPath, 0)
  return { name: basename(folderPath), path: folderPath, type: 'folder', children }
}
