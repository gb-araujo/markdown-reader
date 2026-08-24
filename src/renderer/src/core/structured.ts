import { parse as parseYaml } from 'yaml'

export type StructuredResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string }

/** Parse a JSON or YAML document into a JS value for the tree view. */
export function parseStructured(content: string, language: string | null): StructuredResult {
  const text = content.trim()
  if (text === '') return { ok: false, error: 'Empty document.' }
  try {
    if (language === 'yaml') {
      return { ok: true, value: parseYaml(text) }
    }
    return { ok: true, value: JSON.parse(text) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export type ValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export function valueType(value: unknown): ValueType {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  if (t === 'object') return 'object'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'string'
}

/** Whether a value has children worth expanding. */
export function isExpandable(value: unknown): boolean {
  const t = valueType(value)
  if (t === 'object') return Object.keys(value as object).length > 0
  if (t === 'array') return (value as unknown[]).length > 0
  return false
}

/** Entries [key, value] for an object/array node, in stable order. */
export function entriesOf(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v])
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>)
  return []
}

/** Short one-line preview of a collapsed node, e.g. `{3 keys}` or `[5]`. */
export function collapsedPreview(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length}]`
  const n = Object.keys(value as object).length
  return `{${n} ${n === 1 ? 'key' : 'keys'}}`
}

/** Render a scalar value as display text. */
export function scalarText(value: unknown): string {
  const t = valueType(value)
  if (t === 'string') return JSON.stringify(value)
  if (t === 'null') return 'null'
  return String(value)
}
