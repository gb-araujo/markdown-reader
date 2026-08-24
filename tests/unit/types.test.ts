import { describe, it, expect } from 'vitest'
import { extensionOf, kindForExtension, SUPPORTED_EXTENSIONS } from '../../src/shared/types'

describe('extensionOf', () => {
  it('extracts a lowercased extension', () => {
    expect(extensionOf('C:/docs/README.MD')).toBe('md')
    expect(extensionOf('/home/user/notes.markdown')).toBe('markdown')
  })

  it('handles paths with no extension', () => {
    expect(extensionOf('Makefile')).toBe('')
    expect(extensionOf('C:/folder/LICENSE')).toBe('')
  })

  it('handles dotfiles without treating them as extensions', () => {
    expect(extensionOf('.gitignore')).toBe('')
  })

  it('uses the last dot for multi-dot names', () => {
    expect(extensionOf('archive.tar.gz')).toBe('gz')
    expect(extensionOf('config.local.json')).toBe('json')
  })
})

describe('kindForExtension', () => {
  it('classifies markdown extensions', () => {
    for (const ext of ['md', 'markdown', 'mdown', 'mkd']) {
      expect(kindForExtension(ext)?.kind).toBe('markdown')
    }
  })

  it('classifies code extensions with a language', () => {
    expect(kindForExtension('json')).toEqual({ kind: 'code', language: 'json' })
    expect(kindForExtension('yml')).toEqual({ kind: 'code', language: 'yaml' })
  })

  it('classifies plain text', () => {
    expect(kindForExtension('txt')?.kind).toBe('text')
    expect(kindForExtension('log')?.kind).toBe('text')
  })

  it('returns null for unsupported extensions', () => {
    expect(kindForExtension('exe')).toBeNull()
    expect(kindForExtension('')).toBeNull()
  })
})

describe('SUPPORTED_EXTENSIONS', () => {
  it('includes the primary markdown and text formats', () => {
    for (const ext of ['md', 'txt', 'json', 'yaml', 'log']) {
      expect(SUPPORTED_EXTENSIONS).toContain(ext)
    }
  })
})
