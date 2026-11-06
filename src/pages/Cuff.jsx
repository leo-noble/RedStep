// Cuff view: the wrist card as a full-screen tablet display for use during the walk.
// Big rows to tap off with a gloved finger, the next step highlighted, the hard rules always in
// view. It keeps its own copy of the plan in local storage, so it opens again offline.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { siteById, sitePlaces } from '../data/index.js'
import { cuffCard } from '../lib/cuff.js'
import { fmtHours } from '../lib/mars24.js'
import { pct } from '../compute/walk.js'
import { store } from '../lib/hooks.js'
import { Verdict } from '../components/Atoms.jsx'
import { useEmergency } from '../components/Layout.jsx'
import './cuff.css'

export const CUFF_KEY = 'mw-cuff-v1'

function load() {
  const b = store.get(CUFF_KEY, null)
  const a = b?.result?.analysis
  return b && siteById(b.site) && a && Array.isArray(a.profile) && a.profile.length > 1 && Array.isArray(a.visited) ? b : null
}

export default function Cuff() {
  const b = useMemo(load, [])
  const emergency = useEmergency()
  const tickKey = `mw-cuff-ticks-${b?.made || 0}`
  const [ticks, setTicks] = useState(() => store.get(tickKey, []))
  useEffect(() => { store.set(tickKey, ticks) }, [tickKey, ticks])

  if (!b) {
    return (
      <div className="cuff-empty">
        <h1>No walk on the cuff yet.</h1>
        <p>Plan a walk, press Save the plan, then Open on cuff.</p>
        <Link to="/site/jezero" className="btn btn-primary">Plan a walk <span className="arrow">→</span></Link>
      </div>
    )
  }
  const site = siteById(b.site)
  const a = b.result.analysis
  const stops = sitePlaces(b.site).stops.filter((p) => b.stopIds.includes(p.id))
  const { steps, rules } = cuffCard(a, { stops, settings: b.settings })
  const next = steps.findIndex((_, i) => !ticks.includes(i))
  const toggle = (i) => setTicks((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))

  return (
    <div className="cuffv">
      <header className="cv-head">
        <div>
          <p className="cv-micro">{site.name} · {b.date} · sol {a.mars.sol.toLocaleString()}</p>
          <h1>{next < 0 ? 'Walk complete' : steps[next].what}</h1>
          {next >= 0 && <p className="cv-sub">at {fmtHours(steps[next].t)} Mars time{steps[next].air != null ? ` · plan ${pct(steps[next].air)} air used` : ''}</p>}
        </div>
        <div className="cv-head-r">
          <Verdict status={a.status} />
          <button type="button" className="btn cv-sos" onClick={() => emergency.open()}>Emergency</button>
        </div>
      </header>

      <main className="cv-grid">
        <ol className="cv-steps" aria-label="Walk steps">
          {steps.map((st, i) => {
            const done = ticks.includes(i)
            return (
              <li key={i}>
                <button type="button" aria-pressed={done} className={`${done ? 'done' : ''} ${i === next ? 'now' : ''} ${st.key ? 'key' : ''}`} onClick={() => toggle(i)}>
                  <span className="cv-box" aria-hidden="true">{done ? '✓' : ''}</span>
                  <time>{fmtHours(st.t)}</time>
                  <span className="cv-what"><b>{st.what}</b>{st.note && <small>{st.note}</small>}</span>
                  {st.air != null && <span className="cv-air">{pct(st.air)}</span>}
                </button>
              </li>
            )
          })}
        </ol>
        <aside className="cv-rules" aria-label="Rules">
          <h2>Rules</h2>
          <ul>{rules.map((r) => <li key={r}>{r}</li>)}</ul>
          <dl>
            <div><dt>Walk</dt><dd>{(a.tripDistance / 1000).toFixed(1)} km</dd></div>
            <div><dt>Air left at the end</dt><dd>{pct(a.airLeft)}</dd></div>
            <div><dt>Crew</dt><dd>{a.crew?.length > 1 ? 'Two' : 'One'}{a.drive ? ' · rover' : ''}</dd></div>
          </dl>
          <div className="cv-tools">
            <button type="button" className="btn btn-small" onClick={() => setTicks([])} disabled={!ticks.length}>Clear ticks</button>
            <Link to="/brief" className="btn btn-small">Brief</Link>
          </div>
        </aside>
      </main>
      <p className="cv-foot">Mars local time. Air is the share of suit air used by then, from the plan. Works offline once opened.</p>
    </div>
  )
}
