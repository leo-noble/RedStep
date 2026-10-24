import { useEffect, useId, useRef, useState } from 'react'
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

/** Small popover anchored to a button. Opens on click, hover or focus; closes on Escape. */
export function Pop({ label, children, className = '', icon = '?' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const key = (e) => e.key === 'Escape' && setOpen(false)
    const click = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', click)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', click) }
  }, [open])
  return (
    <span className={`pop ${className}`} ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="pop-btn" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) setOpen(false) }}>
        {icon}
      </button>
      <span id={id} role="tooltip" className="pop-body" hidden={!open}>{children}</span>
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
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    )
  }
  return (
    <div className="slider">
      <div className="slider-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="mono">{format ? format(value) : value}{unit ? ` ${unit}` : ''}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
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
