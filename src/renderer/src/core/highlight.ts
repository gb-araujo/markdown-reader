import hljs from 'highlight.js/lib/common'
import powershell from 'highlight.js/lib/languages/powershell'
import dart from 'highlight.js/lib/languages/dart'

hljs.registerLanguage('powershell', powershell)
hljs.registerLanguage('dart', dart)

/** Skip syntax highlighting above this size to keep the UI responsive. */
export const HIGHLIGHT_SIZE_LIMIT = 512 * 1024

export function highlightCode(code: string, language: string | null): string {
  if (code.length > HIGHLIGHT_SIZE_LIMIT) return escapeHtml(code)
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value
    } catch {
      // fall through to plain text
    }
  }
  return escapeHtml(code)
}

export function knownLanguage(language: string | null): boolean {
  return !!language && !!hljs.getLanguage(language)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
