import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BADGES } from '../content/site.js'
import { GLOSSARY } from '../content/glossary.js'
import { factSource } from '../content/sources.js'
import './atoms.css'

/** NASA data · Derived · Illustrative */
export function Badge({ kind, title }) {
  const b = BADGES[kind]
  if (!b) return null
  return <span className={`chip tag-${kind}`} title={title || b.long}>{b.label}</span>
}

/** Small popover anchored to a button. Opens on click, hover or focus; closes on Escape.
 *  It is drawn in a layer above the page and placed to stay on screen (below the button, or
 *  above it when there is no room), so no scrolling panel can clip it. */
export function Pop({ label, children, className = '', icon = '?' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const id = useId()
  const ref = useRef(null)
  const body = useRef(null)
  const timer = useRef(0)
  const show = () => { clearTimeout(timer.current); setOpen(true) }
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 140) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open) return undefined
    const key = (e) => e.key === 'Escape' && setOpen(false)
    const click = (e) => { if (!ref.current?.contains(e.target) && !body.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', click)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', click) }
  }, [open])
  useLayoutEffect(() => {
    if (!open) return undefined
    const place = () => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const w = Math.min(300, window.innerWidth - 24)
      const h = body.current?.offsetHeight || 120
      const cx = r.left + r.width / 2
      const left = Math.min(Math.max(12, cx - w / 2), window.innerWidth - w - 12)
      const below = r.bottom + 10 + h <= window.innerHeight - 12 || r.top - h - 10 < 12
      setPos({ left, width: w, top: below ? r.bottom + 10 : r.top - h - 10, below, arrow: Math.min(w - 16, Math.max(16, cx - left)) })
    }
    place()
    const id2 = requestAnimationFrame(place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { cancelAnimationFrame(id2); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open])
  return (
    <span className={`pop ${className}`} ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      <button type="button" className="pop-btn" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen((o) => !o)} onFocus={show} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget) && !body.current?.contains(e.relatedTarget)) setOpen(false) }}>
        {icon === 'i' ? (
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="4.2" r="1.25" fill="currentColor" /><rect x="6.9" y="6.6" width="2.2" height="6.4" rx="1.1" fill="currentColor" /></svg>
        ) : icon}
      </button>
      {createPortal(
        <span ref={body} id={id} role="tooltip" className={`pop-body ${pos?.below === false ? 'pop-above' : ''}`} hidden={!open} onMouseEnter={show} onMouseLeave={hide} style={pos ? { left: pos.left, top: pos.top, width: pos.width, '--arrow': `${pos.arrow}px` } : undefined}>{children}</span>,
        document.body,
      )}
    </span>
  )
}

/** Plain-language meaning of a technical word. */
export function Term({ k, children }) {
  const text = GLOSSARY[k]
  return (
    <span className="term">
      {children || k}
      {text && <Pop label={`What is ${k}?`}><b>{k}</b> {text}</Pop>}
    </span>
  )
}

/** Where a number comes from. */
export function Source({ k, note, badge }) {
  const s = factSource(k)
  return (
    <Pop label="Where does this number come from?" icon="i" className="pop-src">
      {badge && <span className="pop-badge"><Badge kind={badge} /></span>}
      {note && <span className="pop-note">{note}</span>}
      {s && <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>}
    </Pop>
  )
}

/** Big figure with label, honesty badge and source. */
export function Stat({ label, value, unit, badge, source, note, tone, small }) {
  return (
    <div className={`stat ${small ? 'stat-small' : ''}`}>
      <div className="stat-label micro">
        {label}
        {(source || note) && <Source k={source} note={note} badge={badge} />}
      </div>
      <div className={`stat-value ${tone ? `v-${tone}` : ''}`}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {badge && !small && <Badge kind={badge} />}
    </div>
  )
}

/** Compact honesty label: a dot (blue NASA data, orange Derived, grey ring Illustrative). */
export function HonestyDot({ kind }) {
  const b = BADGES[kind]
  if (!b) return null
  return <span className={`hdot hdot-${kind}`} title={`${b.label}: ${b.long}`} aria-label={b.label} role="img" />
}

export function Slider({ id, label, value, min, max, step, unit, onChange, badge, note, format, compact }) {
  if (compact) {
    return (
      <div className="slider slider-compact">
        <div className="slider-top">
          <label htmlFor={id}>{badge && <HonestyDot kind={badge} />}{label}{note && <Pop label={`About: ${label}`} icon="i">{badge && <span className="pop-badge"><Badge kind={badge} /></span>}{note}</Pop>}</label>
          <output htmlFor={id} className="mono">{format ? format(value) : value}{unit ? ` ${unit}` : ''}</output>
        </div>
        <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${((value - min) / (max - min)) * 100}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    )
  }
  return (
    <div className="slider">
      <div className="slider-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="mono">{format ? format(value) : value}{unit ? ` ${unit}` : ''}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${((value - min) / (max - min)) * 100}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      {(badge || note) && (
        <div className="slider-meta">
          {badge && <Badge kind={badge} />}
          {note && <span>{note}</span>}
        </div>
      )}
    </div>
  )
}

export function Verdict({ status, size = 'm' }) {
  const t = { go: 'GO', caution: 'CAUTION', nogo: 'NO-GO' }[status]
  return <span className={`verdict verdict-${status} verdict-${size}`}>{t}</span>
}

export function Eyebrow({ children }) {
  return <p className="eyebrow micro">{children}</p>
}
