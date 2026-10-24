// Street view: look around a real rover panorama (drag, arrow keys, zoom). The image is a NASA
// Photojournal mosaic; rover, sol, date, image id and credit are always on screen. Places without
// real imagery use the planner's Demo view instead (see Site.jsx), never this viewer.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from './Atoms.jsx'
import { prefersReducedMotion } from '../lib/hooks.js'
import './streetview.css'

const ZOOMS = [1, 1.5, 2.25, 3]

export default function StreetView({ pano, onClose, children }) {
  const track = useRef(null)
  const closeBtn = useRef(null)
  const [img, setImg] = useState(null) // {w, h} once loaded
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [zoom, setZoom] = useState(0)
  const view = useRef({ x: 0, y: 0.5 }) // x: share of the image width scrolled; y: 0 top .. 1 bottom
  const drag = useRef(null)

  useEffect(() => {
    setImg(null); setFailed(false)
    const im = new Image()
    im.onload = () => setImg({ w: im.naturalWidth, h: im.naturalHeight })
    im.onerror = () => setFailed(true)
    im.src = pano.url
    return () => { im.onload = im.onerror = null }
  }, [pano.url, attempt])

  // draw the view by moving the background (it repeats sideways for full-circle panoramas)
  const paint = useCallback(() => {
    const el = track.current
    if (!el || !img) return
    const H = el.clientHeight * ZOOMS[zoom]
    const W = (img.w / img.h) * H
    const v = view.current
    if (pano.fov < 360) v.x = Math.max(0, Math.min(v.x, Math.max(0, (W - el.clientWidth) / W)))
    const extraY = Math.max(0, H - el.clientHeight)
    el.style.backgroundSize = `${W}px ${H}px`
    el.style.backgroundPosition = `${-v.x * W}px ${-v.y * extraY}px`
  }, [img, zoom, pano.fov])

  useEffect(() => {
    paint()
    const ro = new ResizeObserver(paint)
    if (track.current) ro.observe(track.current)
    return () => ro.disconnect()
  }, [paint])

  useEffect(() => { closeBtn.current?.focus() }, [])
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const pan = (dx, dy = 0) => {
    const el = track.current
    if (!el || !img) return
    const H = el.clientHeight * ZOOMS[zoom]
    const W = (img.w / img.h) * H
    const v = view.current
    v.x = (((v.x + dx / W) % 1) + 1) % 1
    if (H > el.clientHeight) v.y = Math.max(0, Math.min(1, v.y + dy / (H - el.clientHeight)))
    paint()
  }
  const step = (dir) => {
    const el = track.current
    if (!el) return
    const dist = el.clientWidth * 0.35 * dir
    if (prefersReducedMotion()) return pan(dist)
    let done = 0
    const n = 12
    const tick = () => { pan(dist / n); if (++done < n) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }

  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }
  const onMove = (e) => {
    if (!drag.current) return
    pan(drag.current.x - e.clientX, drag.current.y - e.clientY)
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onUp = () => { drag.current = null }
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    if (e.key === 'ArrowUp') { e.preventDefault(); pan(0, -60) }
    if (e.key === 'ArrowDown') { e.preventDefault(); pan(0, 60) }
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))
    if (e.key === '-') setZoom((z) => Math.max(0, z - 1))
  }

  const credit = `${pano.pia} · ${pano.credit}`
  return (
    <div className="sv" role="dialog" aria-modal="true" aria-label={`Street view: ${pano.name}`}>
      <div
        ref={track}
        className={`sv-track ${img ? 'ready' : ''}`}
        style={img ? { backgroundImage: `url("${pano.url}")`, backgroundRepeat: pano.fov >= 360 ? 'repeat-x' : 'no-repeat' } : undefined}
        role="img"
        aria-label={pano.alt}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        {!img && !failed && <p className="sv-state" role="status"><i className="spinner" aria-hidden="true" />Loading the NASA panorama…</p>}
        {failed && (
          <div className="sv-state" role="alert">
            <p>Couldn’t load this panorama. Check your connection.</p>
            <div className="sv-state-actions">
              <button type="button" className="btn btn-small" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
              <a className="btn btn-small" href={pano.page} target="_blank" rel="noreferrer">See it on NASA’s site ↗</a>
            </div>
          </div>
        )}
      </div>
      {img && <p className="sv-credit">{credit}</p>}

      <aside className="sv-card">
        <div className="sv-card-top">
          <Badge kind="nasa" />
          <button ref={closeBtn} type="button" className="btn btn-small sv-close" onClick={onClose}>Close street view</button>
        </div>
        <h2 className="sv-title">{pano.name}</h2>
        <p className="sv-meta">{pano.rover} · {pano.instrument} · Sol {pano.sol} · {pano.date}</p>
        <p className="sv-about">{pano.about}</p>
        <p className="sv-src">Real rover photos: NASA image <a href={pano.page} target="_blank" rel="noreferrer">{pano.pia} ↗</a>, {pano.frames} frames stitched by the camera team. Credit: {pano.credit}.</p>
        <p className="sv-src">Black areas were not photographed.{pano.colour ? ` ${pano.colour}` : ''}</p>
        <details className="sv-where">
          <summary>Where the rover stood</summary>
          <p>{pano.lat.toFixed(5)}° N, {pano.lon.toFixed(5)}° E. {pano.where}</p>
        </details>
        <div className="sv-controls" role="group" aria-label="Look around">
          <button type="button" className="btn btn-small" onClick={() => step(-1)} aria-label="Look left">←</button>
          <button type="button" className="btn btn-small" onClick={() => step(1)} aria-label="Look right">→</button>
          <button type="button" className="btn btn-small" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out">−</button>
          <button type="button" className="btn btn-small" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        </div>
        <p className="sv-hint">Drag the photo or use the arrow keys to look around.</p>
      </aside>
      {children}
    </div>
  )
}
