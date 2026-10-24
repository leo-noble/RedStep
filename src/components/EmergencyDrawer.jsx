import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EMERGENCIES, PRIORITY, PRIORITY_LABEL } from '../content/survival.js'
import { Source } from './Atoms.jsx'
import './emergency.css'

export default function EmergencyDrawer({ state, onClose }) {
  const open = !!state
  const [active, setActive] = useState(EMERGENCIES[0].id)
  const panel = useRef(null)
  const lastFocus = useRef(null)

  useEffect(() => {
    if (!open) return
    if (state.focus) setActive(state.focus)
    lastFocus.current = document.activeElement
    panel.current?.focus()
    const key = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('button, a[href]')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); lastFocus.current?.focus?.() }
  }, [open, state, onClose])

  const e = EMERGENCIES.find((x) => x.id === active)
  return (
    <div className={`sos ${open ? 'sos-open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="sos-scrim" onClick={onClose} />
      <aside className="sos-panel" role="dialog" aria-modal="true" aria-labelledby="sos-title" tabIndex={-1} ref={panel}>
        <div className="sos-head">
          <p className="micro sos-kicker">Emergency</p>
          <button type="button" className="sos-close" onClick={onClose} aria-label="Close emergency guide">×</button>
        </div>
        <h2 id="sos-title" className="sos-title">Remember the order.</h2>
        <ol className="sos-order">
          {PRIORITY.map((p, i) => (
            <li key={p} className={e?.first === p ? 'hot' : ''}>
              <span className="mono">{i + 1}</span>
              <b>{PRIORITY_LABEL[p].word}</b>
              <span>{PRIORITY_LABEL[p].line}</span>
            </li>
          ))}
        </ol>
        <div className="sos-tabs" role="tablist" aria-label="What happened?">
          {EMERGENCIES.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === active} onClick={() => setActive(x.id)}>{x.name}</button>
          ))}
        </div>
        {e && (
          <div className="sos-body" role="tabpanel">
            <ol className="sos-steps">
              {e.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <p className="sos-proc micro">Proposed procedure · never tested on Mars</p>
            <div className="sos-case">
              <p className="micro">It really happened <Source k={e.source} badge="nasa" /></p>
              <p>{e.science}</p>
            </div>
          </div>
        )}
        <Link to="/guide/emergency" className="btn btn-small sos-drill" onClick={onClose}>Practise the drill <span className="arrow">→</span></Link>
      </aside>
    </div>
  )
}
