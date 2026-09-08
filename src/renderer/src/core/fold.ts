/**
 * Collapsible document sections: a heading folds away every sibling that
 * follows it until the next heading of the same or a higher level.
 */

export function headingLevel(el: Element | null): number {
  if (!el) return 0
  const match = /^H([1-6])$/.exec(el.tagName)
  return match ? Number(match[1]) : 0
}

/** Fold or unfold the section owned by `heading`. Returns the new folded state. */
export function toggleSection(heading: HTMLElement): boolean {
  const level = headingLevel(heading)
  if (!level) return false

  const collapse = !heading.classList.contains('collapsed')
  heading.classList.toggle('collapsed', collapse)
  const button = heading.querySelector('.heading-fold')
  button?.setAttribute('aria-expanded', String(!collapse))
  button?.setAttribute('title', collapse ? 'Expand section' : 'Collapse section')

  // While unfolding, a nested heading that is itself collapsed keeps its own
  // section hidden: `nestedLevel` marks how deep that skipped subtree runs.
  let nestedLevel = 0
  let el = heading.nextElementSibling as HTMLElement | null
  while (el) {
    const level_ = headingLevel(el)
    if (level_ && level_ <= level) break
    if (collapse) {
      el.hidden = true
    } else if (!nestedLevel || (level_ && level_ <= nestedLevel)) {
      nestedLevel = 0
      el.hidden = false
      if (level_ && el.classList.contains('collapsed')) nestedLevel = level_
    }
    el = el.nextElementSibling as HTMLElement | null
  }
  return collapse
}

/** Unfold every section in `container`, e.g. before jumping to a heading. */
export function expandAll(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.md-heading.collapsed').forEach((heading) => {
    heading.classList.remove('collapsed')
    const button = heading.querySelector('.heading-fold')
    button?.setAttribute('aria-expanded', 'true')
    button?.setAttribute('title', 'Collapse section')
  })
  container.querySelectorAll<HTMLElement>('[hidden]').forEach((el) => {
    el.hidden = false
  })
}

/**
 * Reveal `target` if it sits inside collapsed sections, so anchors, bookmarks
 * and search hits are never scrolled to behind a fold.
 */
export function revealElement(container: HTMLElement, target: HTMLElement): void {
  let el: HTMLElement | null = target
  while (el && el !== container) {
    if (el.hidden) {
      // Unfold the heading that owns this element.
      let prev = el.previousElementSibling as HTMLElement | null
      while (prev && !(headingLevel(prev) && prev.classList.contains('collapsed'))) {
        prev = prev.previousElementSibling as HTMLElement | null
      }
      if (!prev) {
        el.hidden = false
        break
      }
      toggleSection(prev)
      el = prev
      continue
    }
    el = el.parentElement
  }
}
