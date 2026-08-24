/** Slug generation for heading anchors, shared by the renderer and the TOC. */

export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

/** Tracks used slugs and returns unique ones ("intro", "intro-1", "intro-2", …). */
export class SlugTracker {
  private used = new Map<string, number>()

  unique(text: string): string {
    const base = slugify(text)
    const count = this.used.get(base) ?? 0
    this.used.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }
}
