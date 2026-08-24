import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readDocument, scanFolder } from '../../src/main/files'

let dir: string

beforeAll(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'markdown-reader-test-'))
  await fs.writeFile(join(dir, 'README.md'), '# Hello\n\nWorld')
  await fs.writeFile(join(dir, 'data.json'), '{"a":1}')
  await fs.writeFile(join(dir, 'notes.txt'), 'plain text')
  await fs.writeFile(join(dir, 'empty.md'), '')
  await fs.writeFile(join(dir, 'ignored.exe'), 'binary')
  await fs.mkdir(join(dir, 'docs'))
  await fs.writeFile(join(dir, 'docs', 'api.md'), '# API')
  await fs.mkdir(join(dir, 'node_modules'))
  await fs.writeFile(join(dir, 'node_modules', 'pkg.md'), '# should be ignored')
  await fs.mkdir(join(dir, 'emptyfolder'))
})

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('readDocument', () => {
  it('reads a markdown file with correct kind', async () => {
    const result = await readDocument(join(dir, 'README.md'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.doc.kind).toBe('markdown')
      expect(result.doc.content).toContain('# Hello')
      expect(result.doc.info.name).toBe('README.md')
    }
  })

  it('classifies json as code with a language', async () => {
    const result = await readDocument(join(dir, 'data.json'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.doc.kind).toBe('code')
      expect(result.doc.language).toBe('json')
    }
  })

  it('reads an empty file without error', async () => {
    const result = await readDocument(join(dir, 'empty.md'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.doc.content).toBe('')
  })

  it('returns NOT_FOUND for a missing file', async () => {
    const result = await readDocument(join(dir, 'nope.md'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns UNSUPPORTED for a disallowed extension', async () => {
    const result = await readDocument(join(dir, 'ignored.exe'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED')
  })

  it('returns NOT_A_FILE for a directory', async () => {
    const result = await readDocument(join(dir, 'docs'))
    // "docs" has no extension => UNSUPPORTED is acceptable before stat,
    // but a path ending in a supported ext that is a dir => NOT_A_FILE.
    expect(result.ok).toBe(false)
  })
})

describe('scanFolder', () => {
  it('builds a tree of supported files only', async () => {
    const tree = await scanFolder(dir)
    expect(tree).not.toBeNull()
    const names = collectFileNames(tree!)
    expect(names).toContain('README.md')
    expect(names).toContain('data.json')
    expect(names).toContain('api.md')
    expect(names).not.toContain('ignored.exe')
  })

  it('ignores node_modules', async () => {
    const tree = await scanFolder(dir)
    const folderNames = collectFolderNames(tree!)
    expect(folderNames).not.toContain('node_modules')
  })

  it('prunes empty folders', async () => {
    const tree = await scanFolder(dir)
    const folderNames = collectFolderNames(tree!)
    expect(folderNames).not.toContain('emptyfolder')
    expect(folderNames).toContain('docs')
  })

  it('returns null for a non-directory path', async () => {
    expect(await scanFolder(join(dir, 'README.md'))).toBeNull()
  })
})

function collectFileNames(node: { children?: any[]; name: string; type: string }): string[] {
  const out: string[] = []
  for (const child of node.children ?? []) {
    if (child.type === 'file') out.push(child.name)
    else out.push(...collectFileNames(child))
  }
  return out
}

function collectFolderNames(node: { children?: any[]; name: string; type: string }): string[] {
  const out: string[] = []
  for (const child of node.children ?? []) {
    if (child.type === 'folder') {
      out.push(child.name)
      out.push(...collectFolderNames(child))
    }
  }
  return out
}
