import { describe, it, expect } from 'vitest'
import { slugify, SlugTracker } from '../../src/renderer/src/core/slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Getting Started')).toBe('getting-started')
  })

  it('strips accents (acentos)', () => {
    expect(slugify('Instalação')).toBe('instalacao')
    expect(slugify('Configuração Básica')).toBe('configuracao-basica')
  })

  it('preserves unicode letters that are not accents', () => {
    expect(slugify('日本語')).toBe('日本語')
  })

  it('removes punctuation and collapses spaces', () => {
    expect(slugify('API: Authentication & Tokens!!')).toBe('api-authentication-tokens')
  })

  it('falls back to "section" for empty/symbol-only headings', () => {
    expect(slugify('')).toBe('section')
    expect(slugify('***')).toBe('section')
  })
})

describe('SlugTracker', () => {
  it('disambiguates duplicate headings', () => {
    const t = new SlugTracker()
    expect(t.unique('Intro')).toBe('intro')
    expect(t.unique('Intro')).toBe('intro-1')
    expect(t.unique('Intro')).toBe('intro-2')
  })

  it('tracks different bases independently', () => {
    const t = new SlugTracker()
    expect(t.unique('A')).toBe('a')
    expect(t.unique('B')).toBe('b')
    expect(t.unique('A')).toBe('a-1')
  })
})
