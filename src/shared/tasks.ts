/**
 * GitHub-style task list ("- [ ] todo") source editing, shared by the main and
 * renderer processes. Edits are surgical: only the checkbox character on the
 * targeted line is rewritten, so indentation, trailing spaces and mixed line
 * endings elsewhere in the file survive untouched.
 */

/**
 * A task-list item line: indentation, a bullet or ordered marker, then the
 * checkbox. Group 1 is everything through the opening bracket, group 2 is the
 * state character, group 3 closes the bracket plus the separator that follows.
 */
const TASK_LINE_RE = /^(\s{0,8}(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([ xX])(\](?:[ \t]|$))/

export type TaskToggleFailure = 'OUT_OF_RANGE' | 'NOT_A_TASK' | 'STALE'

export type TaskToggleOutcome =
  | { ok: true; source: string; line: string }
  | { ok: false; reason: TaskToggleFailure }

export function isTaskLine(line: string): boolean {
  return TASK_LINE_RE.test(line)
}

/** Rewrite `line` with its checkbox set to `checked`, or null if it has none. */
export function setTaskLineState(line: string, checked: boolean): string | null {
  const match = TASK_LINE_RE.exec(line)
  if (!match) return null
  return match[1] + (checked ? 'x' : ' ') + match[3] + line.slice(match[0].length)
}

interface LineRange {
  /** Offset of the first character of the line. */
  start: number
  /** Offset of the terminating newline, or the end of the source. */
  end: number
  /** Line text without its trailing CR (if the file uses CRLF). */
  text: string
  cr: boolean
}

function lineRange(source: string, lineIndex: number): LineRange | null {
  if (!Number.isInteger(lineIndex) || lineIndex < 0) return null
  let start = 0
  for (let i = 0; i < lineIndex; i++) {
    const newline = source.indexOf('\n', start)
    if (newline === -1) return null
    start = newline + 1
  }
  const newline = source.indexOf('\n', start)
  const end = newline === -1 ? source.length : newline
  let text = source.slice(start, end)
  const cr = text.endsWith('\r')
  if (cr) text = text.slice(0, -1)
  return { start, end, text, cr }
}

/** Text of a single 0-based line, or null when the line does not exist. */
export function lineAt(source: string, lineIndex: number): string | null {
  return lineRange(source, lineIndex)?.text ?? null
}

/**
 * Flip the checkbox on line `lineIndex`. When `expected` is supplied the line
 * must still match it, which is how a document edited outside the app is
 * detected before we overwrite someone else's change.
 */
export function toggleTaskInSource(
  source: string,
  lineIndex: number,
  checked: boolean,
  expected?: string
): TaskToggleOutcome {
  const range = lineRange(source, lineIndex)
  if (!range) return { ok: false, reason: 'OUT_OF_RANGE' }
  if (expected !== undefined && expected !== range.text) return { ok: false, reason: 'STALE' }
  const replaced = setTaskLineState(range.text, checked)
  if (replaced === null) return { ok: false, reason: 'NOT_A_TASK' }
  return {
    ok: true,
    line: replaced,
    source: source.slice(0, range.start) + replaced + (range.cr ? '\r' : '') + source.slice(range.end)
  }
}
