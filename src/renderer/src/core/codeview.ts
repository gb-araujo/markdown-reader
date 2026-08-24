import { highlightCode, escapeHtml, HIGHLIGHT_SIZE_LIMIT } from './highlight'

/**
 * Render a plain-text or code document (json, yaml, log, …) as HTML with a
 * line-number gutter and optional syntax highlighting.
 */
export function renderCodeDocument(content: string, language: string | null): string {
  // Normalize line endings so the gutter matches the visible lines.
  const normalized = content.replace(/\r\n?/g, '\n')
  const lineCount = normalized.length === 0 ? 1 : normalized.split('\n').length
  const highlighted =
    normalized.length > HIGHLIGHT_SIZE_LIMIT || !language
      ? escapeHtml(normalized)
      : highlightCode(normalized, language)

  let gutter = ''
  for (let i = 1; i <= lineCount; i++) gutter += `${i}\n`

  return (
    `<div class="code-view">` +
    `<pre class="code-view-gutter" aria-hidden="true">${gutter}</pre>` +
    `<pre class="code-view-content"><code class="hljs">${highlighted}</code></pre>` +
    `</div>`
  )
}
