import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { toggleTaskInFile } from '../../src/main/files'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'markdown-reader-tasks-'))
})

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

async function write(name: string, content: string): Promise<string> {
  const path = join(dir, name)
  await fs.writeFile(path, content, 'utf-8')
  return path
}

describe('toggleTaskInFile', () => {
  const doc = '# Todo\n\n- [ ] first\n- [x] second\n'

  it('writes the new state to disk and reports the updated document', async () => {
    const path = await write('todo.md', doc)
    const result = await toggleTaskInFile(path, 2, true, '- [ ] first')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toBe('# Todo\n\n- [x] first\n- [x] second\n')
    expect(await fs.readFile(path, 'utf-8')).toBe(result.content)
    expect(result.size).toBe(Buffer.byteLength(result.content))
    expect(result.modifiedAt).toBeGreaterThan(0)
  })

  it('unchecks an item', async () => {
    const path = await write('todo.md', doc)
    const result = await toggleTaskInFile(path, 3, false, '- [x] second')
    expect(result.ok && result.content).toBe('# Todo\n\n- [ ] first\n- [ ] second\n')
  })

  it('refuses to write when the line changed on disk', async () => {
    const path = await write('todo.md', doc)
    await fs.writeFile(path, '# Todo\n\n- [ ] renamed\n- [x] second\n', 'utf-8')
    const result = await toggleTaskInFile(path, 2, true, '- [ ] first')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/changed on disk/i)
    // The file is left exactly as the other editor wrote it.
    expect(await fs.readFile(path, 'utf-8')).toBe('# Todo\n\n- [ ] renamed\n- [x] second\n')
  })

  it('rejects a line that is not a task item', async () => {
    const path = await write('todo.md', doc)
    const result = await toggleTaskInFile(path, 0, true, '# Todo')
    expect(result.ok).toBe(false)
    expect(await fs.readFile(path, 'utf-8')).toBe(doc)
  })

  it('rejects a line past the end of the file', async () => {
    const path = await write('todo.md', doc)
    expect((await toggleTaskInFile(path, 99, true, '- [ ] first')).ok).toBe(false)
  })

  it('refuses to write to a non-markdown document', async () => {
    const path = await write('todo.txt', doc)
    const result = await toggleTaskInFile(path, 2, true, '- [ ] first')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Markdown/)
    expect(await fs.readFile(path, 'utf-8')).toBe(doc)
  })

  it('reports a missing file instead of creating one', async () => {
    const path = join(dir, 'gone.md')
    const result = await toggleTaskInFile(path, 0, true, '- [ ] a')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not found/i)
    await expect(fs.access(path)).rejects.toThrow()
  })

  it('preserves CRLF line endings elsewhere in the file', async () => {
    const path = await write('crlf.md', '- [ ] a\r\n- [ ] b\r\n')
    const result = await toggleTaskInFile(path, 1, true, '- [ ] b')
    expect(result.ok && result.content).toBe('- [ ] a\r\n- [x] b\r\n')
  })

  it('survives repeated toggles of the same task', async () => {
    const path = await write('todo.md', doc)
    expect((await toggleTaskInFile(path, 2, true, '- [ ] first')).ok).toBe(true)
    expect((await toggleTaskInFile(path, 2, false, '- [x] first')).ok).toBe(true)
    expect(await fs.readFile(path, 'utf-8')).toBe(doc)
  })
})
