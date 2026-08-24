/**
 * Lazy Mermaid rendering. Mermaid is heavy, so it is imported on demand the
 * first time a document actually contains a diagram.
 */
let mermaidModule: typeof import('mermaid').default | null = null
let currentTheme: 'light' | 'dark' | null = null
let diagramSeq = 0

async function getMermaid(theme: 'light' | 'dark'): Promise<typeof import('mermaid').default> {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }
  if (currentTheme !== theme) {
    mermaidModule.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default'
    })
    currentTheme = theme
  }
  return mermaidModule
}

/**
 * Render every unprocessed `.mermaid-block` inside a container into an SVG.
 * Safe to call repeatedly (idempotent via the data-processed flag).
 */
export async function renderMermaidBlocks(
  container: HTMLElement,
  theme: 'light' | 'dark'
): Promise<void> {
  const blocks = container.querySelectorAll<HTMLElement>('.mermaid-block[data-processed="false"]')
  if (blocks.length === 0) return

  let mermaid: typeof import('mermaid').default
  try {
    mermaid = await getMermaid(theme)
  } catch {
    blocks.forEach((b) => b.setAttribute('data-processed', 'error'))
    return
  }

  for (const block of blocks) {
    block.setAttribute('data-processed', 'true')
    const source = block.querySelector('.mermaid-source')?.textContent ?? ''
    const target = block.querySelector<HTMLElement>('.mermaid-render')
    if (!target || !source.trim()) continue
    try {
      const { svg } = await mermaid.render(`mermaid-diagram-${diagramSeq++}`, source)
      target.innerHTML = svg
    } catch (err) {
      block.setAttribute('data-processed', 'error')
      target.innerHTML = ''
      const pre = document.createElement('pre')
      pre.className = 'mermaid-error'
      pre.textContent = `Diagram error: ${(err as Error).message ?? 'invalid mermaid syntax'}`
      target.appendChild(pre)
    }
  }
}

/** Force re-render on theme change by clearing processed flags. */
export function resetMermaid(container: HTMLElement): void {
  container.querySelectorAll('.mermaid-block').forEach((b) => {
    b.setAttribute('data-processed', 'false')
    const target = b.querySelector('.mermaid-render')
    if (target) target.innerHTML = ''
  })
}
