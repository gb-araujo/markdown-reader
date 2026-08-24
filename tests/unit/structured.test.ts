import { describe, it, expect } from 'vitest'
import {
  parseStructured,
  valueType,
  isExpandable,
  entriesOf,
  collapsedPreview,
  scalarText
} from '../../src/renderer/src/core/structured'

describe('parseStructured', () => {
  it('parses JSON', () => {
    const r = parseStructured('{"a": 1, "b": [2, 3]}', 'json')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: 1, b: [2, 3] })
  })

  it('parses YAML', () => {
    const r = parseStructured('a: 1\nb:\n  - 2\n  - 3', 'yaml')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: 1, b: [2, 3] })
  })

  it('reports an error for invalid JSON', () => {
    const r = parseStructured('{ not json ]', 'json')
    expect(r.ok).toBe(false)
  })

  it('reports an error for empty content', () => {
    const r = parseStructured('   ', 'json')
    expect(r.ok).toBe(false)
  })
})

describe('valueType', () => {
  it('classifies values', () => {
    expect(valueType({})).toBe('object')
    expect(valueType([])).toBe('array')
    expect(valueType('x')).toBe('string')
    expect(valueType(1)).toBe('number')
    expect(valueType(true)).toBe('boolean')
    expect(valueType(null)).toBe('null')
  })
})

describe('isExpandable', () => {
  it('is true for non-empty objects/arrays', () => {
    expect(isExpandable({ a: 1 })).toBe(true)
    expect(isExpandable([1])).toBe(true)
  })
  it('is false for empty containers and scalars', () => {
    expect(isExpandable({})).toBe(false)
    expect(isExpandable([])).toBe(false)
    expect(isExpandable('x')).toBe(false)
  })
})

describe('entriesOf', () => {
  it('returns indexed entries for arrays', () => {
    expect(entriesOf(['a', 'b'])).toEqual([
      ['0', 'a'],
      ['1', 'b']
    ])
  })
  it('returns key/value entries for objects', () => {
    expect(entriesOf({ x: 1 })).toEqual([['x', 1]])
  })
})

describe('collapsedPreview', () => {
  it('summarizes arrays and objects', () => {
    expect(collapsedPreview([1, 2, 3])).toBe('[3]')
    expect(collapsedPreview({ a: 1 })).toBe('{1 key}')
    expect(collapsedPreview({ a: 1, b: 2 })).toBe('{2 keys}')
  })
})

describe('scalarText', () => {
  it('quotes strings and stringifies others', () => {
    expect(scalarText('hi')).toBe('"hi"')
    expect(scalarText(42)).toBe('42')
    expect(scalarText(true)).toBe('true')
    expect(scalarText(null)).toBe('null')
  })
})
