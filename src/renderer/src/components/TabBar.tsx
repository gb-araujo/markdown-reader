import { useApp } from '../store'

export default function TabBar(): React.JSX.Element {
  const { tabs, activeTabId, activateTab, closeTab, closeOtherTabs } = useApp()

  return (
    <div className="tabbar" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          className={`tab${tab.id === activeTabId ? ' active' : ''}`}
          title={tab.path}
          onClick={() => activateTab(tab.id)}
          onAuxClick={(e) => {
            if (e.button === 1) closeTab(tab.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            if (e.shiftKey) closeOtherTabs(tab.id)
          }}
        >
          <span className="tab-title">{tab.name}</span>
          <button
            className="tab-close"
            title="Close (Ctrl+W)"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.id)
            }}
            aria-label={`Close ${tab.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
