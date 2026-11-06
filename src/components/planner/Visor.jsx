// Helmet visor HUD: what an astronaut would see projected inside the helmet while walking.
// Heading tape, suit air, sun height, Mars time, the next science stop and the turn-back alert.
// It is updated straight from the animation loop through its ref (no React re-renders per frame).
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { fmtHours } from '../../lib/mars24.js'
import './visor.css'

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(2)} km`)

/**
 * Imperative update({ heading, d, air, sun, ltst, slope, next: { name, m } | null,
 *   turn: { m } | null (metres to the turn-back point; negative = past it), home: m })
 * Any field may be left out; it keeps its last value.
 */
const Visor = forwardRef(function Visor({ title = 'Suit display', onExit, children }, ref) {
  const root = useRef(null)
  const tape = useRef(null)
  const q = (k) => root.current?.querySelector(`[data-v=${k}]`)

  useImperativeHandle(ref, () => ({
    update(v) {
      if (!root.current) return
      if (v.heading != null) {
        const h = ((v.heading % 360) + 360) % 360
        // the tape shows 30 px per 10 degrees; it repeats, so slide it modulo one turn
        if (tape.current) tape.current.style.transform = `translateX(${-h * 3}px)`
        q('hdg').textContent = `${String(Math.round(h) % 360).padStart(3, '0')}° ${CARD[Math.round(h / 45) % 8]}`
      }
      if (v.air != null) {
        const left = Math.max(0, 1 - v.air)
        q('air').textContent = `${Math.round(left * 100)}%`
        q('airbar').style.transform = `scaleY(${left})`
        root.current.classList.toggle('vz-airlow', left < 0.35)
      }
      if (v.sun != null) q('sun').textContent = `${v.sun.toFixed(0)}°`
      if (v.ltst != null) q('time').textContent = fmtHours(v.ltst)
      if (v.slope != null) q('slope').textContent = `${v.slope.toFixed(0)}°`
      if (v.d != null) q('d').textContent = fmtDist(v.d)
      if (v.home != null) q('home').textContent = fmtDist(v.home)
      if (v.next !== undefined) {
        q('next').textContent = v.next ? `${v.next.name} · ${fmtDist(v.next.m)}` : 'No more stops ahead'
      }
      if (v.turn !== undefined) {
        const el = q('alert')
        const t = v.turn
        if (!t || t.m > 400) { el.hidden = true; return }
        el.hidden = false
        el.textContent = t.m > 0 ? `Turn back in ${fmtDist(t.m)}` : 'TURN BACK NOW'
        el.classList.toggle('vz-alert-now', t.m <= 0)
      }
    },
  }), [])

  return (
    <div className="visor" ref={root} role="region" aria-label={title}>
      <div className="vz-glass" aria-hidden="true" />
      <div className="vz-top">
        <div className="vz-tape" aria-hidden="true">
          <div className="vz-tape-track" ref={tape}>
            {Array.from({ length: 108 }, (_, k) => {
              const deg = (k * 10) - 360
              const n = ((deg % 360) + 360) % 360
              return <span key={k} className={n % 90 === 0 ? 'vz-major' : ''}>{n % 90 === 0 ? CARD[n / 45] : n % 30 === 0 ? n : ''}</span>
            })}
          </div>
          <i className="vz-caret" />
        </div>
        <b className="vz-hdg mono" data-v="hdg">000° N</b>
      </div>

      <div className="vz-left">
        <span className="vz-label">Suit air</span>
        <div className="vz-gauge"><i data-v="airbar" /></div>
        <b className="mono" data-v="air">100%</b>
      </div>

      <div className="vz-right">
        <span className="vz-label">Sun</span><b className="mono" data-v="sun">—</b>
        <span className="vz-label">Mars time</span><b className="mono" data-v="time">—</b>
        <span className="vz-label">Slope</span><b className="mono" data-v="slope">—</b>
      </div>

      <p className="vz-alert" data-v="alert" role="alert" hidden />

      <div className="vz-bottom">
        <span><span className="vz-label">Walked</span><b className="mono" data-v="d">0 m</b></span>
        <span className="vz-next"><span className="vz-label">Next stop</span><b data-v="next">—</b></span>
        <span><span className="vz-label">To home</span><b className="mono" data-v="home">—</b></span>
      </div>
      {children}
      {onExit && <button type="button" className="btn btn-small vz-exit" onClick={onExit}>Exit visor</button>}
    </div>
  )
})

export default Visor
