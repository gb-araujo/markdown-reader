import { useState } from 'react'
import {
  entriesOf,
  isExpandable,
  collapsedPreview,
  scalarText,
  valueType
} from '../core/structured'

interface NodeProps {
  name: string | null
  value: unknown
  depth: number
  defaultOpen: boolean
}

function TreeNode({ name, value, depth, defaultOpen }: NodeProps): React.JSX.Element {
  const expandable = isExpandable(value)
  const [open, setOpen] = useState(defaultOpen)
  const type = valueType(value)

  return (
    <div className="jt-node">
      <div
        className={`jt-row${expandable ? ' jt-expandable' : ''}`}
        style={{ paddingLeft: 6 + depth * 16 }}
        onClick={expandable ? () => setOpen((o) => !o) : undefined}
      >
        {expandable ? (
          <span className="jt-caret">{open ? '▾' : '▸'}</span>
        ) : (
          <span className="jt-caret jt-caret-empty" />
        )}
        {name !== null && <span className="jt-key">{name}</span>}
        {name !== null && <span className="jt-colon">: </span>}
        {expandable ? (
          !open && <span className="jt-preview">{collapsedPreview(value)}</span>
        ) : (
          <span className={`jt-value jt-${type}`}>{scalarText(value)}</span>
        )}
      </div>
      {expandable && open && (
        <div className="jt-children">
          {entriesOf(value).map(([key, child]) => (
            <TreeNode
              key={key}
              name={key}
              value={child}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function JsonTree({ value }: { value: unknown }): React.JSX.Element {
  return (
    <div className="json-tree">
      <TreeNode name={null} value={value} depth={0} defaultOpen={true} />
    </div>
  )
}
