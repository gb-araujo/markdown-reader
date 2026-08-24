import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../store'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8

export default function Lightbox(): React.JSX.Element | null {
  const { lightbox, closeLightbox } = useApp()
  const [scale, setScale] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  // Reset zoom whenever a different image is opened.
  useEffect(() => {
    setScale(1)
  }, [lightbox?.url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!lightbox) return
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === '+' || e.key === '=') setScale((s) => clamp(s * 1.2))
      else if (e.key === '-') setScale((s) => clamp(s / 1.2))
      else if (e.key === '0') setScale(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLightbox])

  const flash = useCallback((msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  if (!lightbox) return null

  const onWheel = (e: React.WheelEvent): void => {
    setScale((s) => clamp(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
  }

  const copy = async (): Promise<void> => {
    const res = await window.api.copyImage(lightbox.path)
    flash(res.ok ? 'Image copied' : res.error ?? 'Could not copy')
  }
  const save = async (): Promise<void> => {
    const res = await window.api.saveImage(lightbox.path)
    if (res.ok) flash('Image saved')
    else if (res.error && res.error !== 'canceled') flash(res.error)
  }

  return (
    <div className="lightbox" onClick={closeLightbox}>
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button className="tb-btn" title="Zoom out" onClick={() => setScale((s) => clamp(s / 1.2))}>
          −
        </button>
        <span className="lightbox-zoom">{Math.round(scale * 100)}%</span>
        <button className="tb-btn" title="Zoom in" onClick={() => setScale((s) => clamp(s * 1.2))}>
          +
        </button>
        <button className="tb-btn" title="Reset" onClick={() => setScale(1)}>
          Reset
        </button>
        <div className="tb-sep" />
        <button className="tb-btn" onClick={() => void copy()}>
          Copy
        </button>
        <button className="tb-btn" onClick={() => void save()}>
          Save
        </button>
        <button className="tb-btn" onClick={() => window.api.showInFolder(lightbox.path)}>
          Show in Folder
        </button>
        <button className="tb-btn" title="Close (Esc)" onClick={closeLightbox}>
          ×
        </button>
      </div>
      <div className="lightbox-stage" onWheel={onWheel} onClick={(e) => e.stopPropagation()}>
        <img
          className="lightbox-img"
          src={lightbox.url}
          alt={lightbox.alt}
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>
      {toast && <div className="lightbox-toast">{toast}</div>}
    </div>
  )
}

function clamp(v: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))
}
