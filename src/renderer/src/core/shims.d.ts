// Minimal ambient declarations for markdown-it plugins that ship without types.
declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'
  interface TexmathOptions {
    engine: unknown
    delimiters?: string | string[]
    katexOptions?: Record<string, unknown>
  }
  const plugin: (md: MarkdownIt, options?: TexmathOptions) => void
  export default plugin
}
