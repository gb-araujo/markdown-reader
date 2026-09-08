import type MarkdownIt from 'markdown-it'
import type { StateCore, Token } from 'markdown-it'
import { escapeHtml } from './highlight'

export interface TaskItem {
  /** 0-based line in the markdown source that carries the `[ ]` marker. */
  line: number
  checked: boolean
  text: string
}

/** Environment key the rule writes the tasks it found to. */
export interface TaskEnv {
  tasks?: TaskItem[]
}

/** The checkbox marker at the start of a task item's text. */
const MARKER_RE = /^\[([ xX])\](?=[ \t]|$)/

/**
 * Replacement for `markdown-it-task-lists` that also records where each
 * checkbox came from. The `data-task-line` it emits is what lets a click in the
 * Viewer write the new state back to the exact line of the source file.
 *
 * The tasks found, in document order, are left on `env.tasks`.
 */
export function taskLists(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'task-lists', (state) => {
    const tokens = state.tokens
    const tasks: TaskItem[] = []

    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]
      const itemOpen = tokens[i - 2]
      if (
        inline.type !== 'inline' ||
        tokens[i - 1].type !== 'paragraph_open' ||
        itemOpen.type !== 'list_item_open'
      ) {
        continue
      }
      const match = MARKER_RE.exec(inline.content)
      // Without a source map the toggle could never be written back, so such an
      // item stays plain text rather than showing a checkbox that does nothing.
      const line = itemOpen.map?.[0]
      const first = inline.children?.[0]
      if (!match || line === undefined || first?.type !== 'text') continue

      const checked = match[1] !== ' '
      const index = tasks.length
      inline.content = inline.content.slice(match[0].length)
      first.content = first.content.slice(match[0].length)
      const text = inline.content.trim()
      inline.children!.unshift(checkboxToken(state, index, line, checked, text))

      attrJoin(itemOpen, 'class', 'task-list-item')
      itemOpen.attrSet('data-task-line', String(line))
      itemOpen.attrSet('data-task-index', String(index))
      const list = tokens[parentIndex(tokens, i - 2)]
      if (list) attrJoin(list, 'class', 'contains-task-list')

      tasks.push({ line, checked, text })
    }

    ;(state.env as TaskEnv).tasks = tasks
  })
}

/**
 * A checkbox on its own is announced as just "checkbox", so the item's text
 * becomes its label. Angle brackets are dropped rather than escaped: the
 * sanitizer discards any attribute whose value contains one, which would take
 * the whole label with it.
 */
function labelFor(text: string): string {
  const flat = text.replace(/[<>]/g, '').trim()
  return escapeHtml(flat.length > 120 ? `${flat.slice(0, 119)}…` : flat)
}

function checkboxToken(
  state: StateCore,
  index: number,
  line: number,
  checked: boolean,
  label: string
): Token {
  const token = new state.Token('html_inline', '', 0)
  token.content =
    `<input type="checkbox" class="task-list-item-checkbox"` +
    ` data-task-index="${index}" data-task-line="${line}"` +
    ` aria-label="${labelFor(label)}"${checked ? ' checked=""' : ''}>`
  return token
}

function attrJoin(token: Token, name: string, value: string): void {
  const existing = token.attrGet(name)
  if (existing?.split(' ').includes(value)) return
  token.attrSet(name, existing ? `${existing} ${value}` : value)
}

/** Index of the `bullet_list_open` / `ordered_list_open` enclosing an item. */
function parentIndex(tokens: Token[], itemIndex: number): number {
  const target = tokens[itemIndex].level - 1
  for (let i = itemIndex - 1; i >= 0; i--) {
    if (tokens[i].level === target) return i
  }
  return -1
}
