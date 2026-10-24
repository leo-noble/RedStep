import { useCallback } from 'react'
import { Link } from 'react-router'
import { Badge, HonestyDot, Pop, Source, Slider, Verdict } from '../Atoms.jsx'
import { DATA } from '../../content/sources.js'
import { WALK } from '../../content/assumptions.js'
import { ICE_NOTE } from '../../content/layers.js'
import { ADVISOR_LABEL } from '../../lib/advisor.js'
import { fmtH, pct } from '../../compute/walk.js'
import { fmtHours } from '../../lib/mars24.js'
import { useCountUp } from '../../lib/hooks.js'
import { SbDisclosure } from '../Sidebar.jsx'

const dataById = Object.fromEntries(DATA.map((d) => [d.id, d]))

/* ---------------- layers ---------------- */
export function LayerPanel({ groups, state, onToggle, onOpacity, iceNote = ICE_NOTE }) {
  return (
    <div className="lp">
      {groups.map((g) => (
        <section key={g.id} className="lp-group" aria-labelledby={`lp-${g.id}`}>
          <h3 id={`lp-${g.id}`} className="micro">{g.name}</h3>
          {g.layers.map((l) => {
            const st = state[l.id]
            const src = dataById[l.source]
            return (
              <div key={l.id} className={`lp-row ${st.on ? 'on' : ''}`}>
                <div className="lp-line">
                  <label className="lp-toggle">
                    <input type="checkbox" checked={st.on} onChange={(e) => onToggle(l.id, e.target.checked)} />
                    <span className="lp-switch" aria-hidden="true" />
                    <span className="lp-text">
                      <span className="lp-name"><HonestyDot kind={l.badge} />{l.name}</span>
                      <span className="lp-meta-line">{l.instrument} · {l.res}</span>
                    </span>
                  </label>
                  <Pop label={`About ${l.name}`} icon="i">
                    <b>{l.name}.</b> {l.plain}.<br />
                    {l.mission} · {l.instrument} · {l.res}
                    {src && <><br />{src.product}. {src.by}. {src.licence}.</>}
                    <span className="pop-badge" style={{ marginTop: 8 }}><Badge kind={l.badge} /></span>
                  </Pop>
                </div>
                {st.on && l.kind !== 'stops' && l.kind !== 'radius' && (
                  <input className="lp-opacity" type="range" min="0" max="1" step="0.05" value={st.opacity} aria-label={`${l.name} opacity`} onChange={(e) => onOpacity(l.id, Number(e.target.value))} />
                )}
              </div>
            )
          })}
        </section>
      ))}
      {iceNote && (
        <section className="lp-group">
          <h3 className="micro">Water and ice</h3>
          <p className="lp-note">{iceNote}</p>
        </section>
      )}
    </div>
  )
}

/* ---------------- verdict ---------------- */
function Count({ value, format }) {
  const ref = useCountUp(value, format)
  return <span ref={ref}>{format(value)}</span>
}
const f1 = (x) => x.toFixed(1)
const f0 = (x) => Math.round(x).toLocaleString()
const fp = (x) => `${Math.round(x * 100)}`

export function VerdictPanel({ analysis: a, settings: s, busy, onFix, onEmergency, visitedCount, snap }) {
  if (!a) {
    return (
      <div className="vp vp-empty">
        <p className="vp-empty-title">Plan a walk on Mars</p>
        <ol className="vp-steps">
          <li><b>Press “Suggest a safe walk”.</b> We find a safe path to real rock-sample sites.</li>
          <li><b>Read the answer.</b> GO means safe. The reasons are listed in plain words.</li>
          <li><b>Fly along in 3D</b>, or save the plan.</li>
        </ol>
      </div>
    )
  }
  const shown = a.reasons.filter((r) => r.level !== 'note').slice(0, 3)
  const notes = a.reasons.filter((r) => r.level === 'note')
  const airBar = Math.min(1, a.airUsed)
  const turnPct = a.turnBack.atEnd ? null : a.turnBack.d / a.distance
  return (
    <div className={`vp vp-${a.status} ${busy ? 'busy' : ''}`} aria-live="polite">
      <div className="vp-head">
        <Verdict status={a.status} size="l" />
        <p className="vp-plain">{a.status === 'go' ? 'This walk looks safe.' : a.status === 'caution' ? 'Possible, but be careful.' : 'Do not go on this walk.'}</p>
      </div>
      {shown.length > 0 ? (
        <ul className="vp-reasons">
          {shown.map((r) => (
            <li key={r.code} className={`vp-reason vp-${r.level}`}>
              <b>{r.title}</b>
              <span>{r.code === 'steep' && snap ? `Even the safest path reaches ${a.maxSlope.toFixed(0)}° here, so the point you chose sits on steep ground. Move it a little, or stop short of it.` : r.detail}</span>
              <span className="vp-reason-actions">
                {r.code === 'steep' && !snap && <button type="button" className="btn btn-small" onClick={() => onFix('snap')}>Fix it: go around the steep part</button>}
                {r.code === 'air' && <button type="button" className="btn btn-small" onClick={() => onFix('trim')}>Fix it: make the walk shorter</button>}
                {r.code === 'dark' && <button type="button" className="btn btn-small" onClick={() => onFix('early')}>Fix it: leave earlier</button>}
                {r.protocol && <button type="button" className="vp-proto" onClick={() => onEmergency(r.protocol === 'power' ? 'dark' : 'suit')}>What if it goes wrong?</button>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="vp-good">
          {a.good.map((g) => <li key={g}>{g}</li>)}
        </ul>
      )}

      <div className="vp-air">
        <div className="vp-air-top">
          <span className="micro">Suit air used</span>
          <span className="mono"><Count value={a.airUsed} format={fp} />% of {s.suitHours} h</span>
        </div>
        <div className="vp-bar" role="img" aria-label={`Uses ${pct(a.airUsed)} of suit air. Allowed ${pct(a.budget)}; reserve ${s.reserve}%.`}>
          <span className="vp-bar-fill" style={{ width: `${airBar * 100}%` }} />
          <span className="vp-bar-reserve" style={{ left: `${a.budget * 100}%` }} />
        </div>
        <div className="vp-air-legend micro">
          <span>0</span>
          <span style={{ left: `${a.budget * 100}%` }} className="vp-res-label">reserve {s.reserve}%</span>
        </div>
        <p className="vp-turn">
          <i className="vp-turn-dot" aria-hidden="true" />
          {a.turnBack.atEnd
            ? <>Turn around at the end of the route, <b>{(a.distance / 1000).toFixed(1)} km</b> from home.</>
            : <>You must turn around after <b>{(a.turnBack.d / 1000).toFixed(1)} km</b> ({Math.round(turnPct * 100)}% of the way) to keep your safety reserve.</>}
          <Source note="Turn-back point: the furthest point where the air you have used plus the air to walk home the same way still leaves your reserve untouched. Air use rises when climbing (setting: extra air when climbing)." badge="derived" />
        </p>
      </div>

      <dl className="vp-stats vp-key">
        <div><dt>Walk</dt><dd><Count value={a.tripDistance / 1000} format={f1} /><small>km</small></dd></div>
        <div><dt>Time outside</dt><dd>{fmtH(a.hours)}</dd></div>
        <div><dt>Air left at home</dt><dd className={a.airLeft < 1 - a.budget ? 'v-nogo' : ''}>{a.airLeft > 0 ? pct(a.airLeft) : 'none'}</dd></div>
        <div><dt>Home by</dt><dd>{fmtHours(a.sun.end.ltst)}<small>Mars time</small></dd></div>
      </dl>

      <details className="vp-more">
        <summary>More details</summary>
        <dl className="vp-stats">
          <div><dt className="micro">Steepest ground</dt><dd className={a.maxSlope > s.redSlope ? 'v-nogo' : a.maxSlope > s.greenSlope ? 'v-caution' : ''}><Count value={a.maxSlope} format={f0} /><small>°</small></dd><span className="vp-sub">your limit {s.redSlope}° <Badge kind="derived" /></span></div>
          <div><dt className="micro">Climb</dt><dd>↑<Count value={a.gain} format={f0} /><small>m</small></dd><span className="vp-sub">↓{Math.round(a.loss)} m on the way out</span></div>
          <div><dt className="micro">Sun height</dt><dd>{a.sun.start.elevation.toFixed(0)}°<small>→ {a.sun.end.elevation.toFixed(0)}°</small></dd><span className="vp-sub">leave {fmtHours(a.sun.start.ltst)} <Source k="mars24" note="Sun height from NASA GISS's Mars24 algorithm for this day and place." badge="derived" /></span></div>
          <div><dt className="micro">Radiation</dt><dd>{a.dose.toFixed(2)}<small>mSv</small></dd><span className="vp-sub">about {Math.max(1, Math.round(a.dose / 0.1))} chest X-ray <Source k="rad" note="0.64 mSv per day measured by Curiosity's RAD at Gale Crater, applied to the hours outside." badge="nasa" /></span></div>
          <div><dt className="micro">Farthest from home</dt><dd className={a.farthest > s.walkBack * 1000 ? 'v-caution' : ''}>{(a.farthest / 1000).toFixed(1)}<small>km</small></dd><span className="vp-sub">safe circle {s.walkBack} km</span></div>
          <div><dt className="micro">Message to Earth</dt><dd>{a.comms.lightMin.toFixed(1)}<small>min</small></dd><span className="vp-sub">one way <Source k="meeus" note="Light time from the Earth–Mars distance on this date, from the planets' orbits." badge="derived" /></span></div>
        </dl>
        <p className="vp-sub">Walking speed {s.flatPace} km/h on flat ground, suit air {s.suitHours} h. Change these in Settings. <Badge kind="illustrative" /></p>
      </details>

      {notes.length > 0 && (
        <ul className="vp-notes">
          {notes.map((r) => <li key={r.code}><b>{r.title}.</b> {r.detail}</li>)}
        </ul>
      )}
      {visitedCount > 0 && <p className="vp-science micro">Science stops on this walk: <b>{visitedCount}</b></p>}
    </div>
  )
}

/* ---------------- science ---------------- */
export function SciencePanel({ stops, visited, onAdd, onFocus, score, focus }) {
  return (
    <div className="sp">
      <div className="sp-score">
        <div>
          <p className="micro">Science value of this walk</p>
          <p className="sp-score-num"><b>{score.got}</b><span>/ {score.total}</span></p>
        </div>
        <p className="sp-score-note">Each stop has a science priority from 1 to 5 (our judgement, explained on each card). Safer walks reach fewer stops. That trade-off is the point.</p>
      </div>
      <ol className="sp-list">
        {stops.map((s) => {
          const on = visited.includes(s.id)
          return (
            <li key={s.id} className={`sp-card ${on ? 'on' : ''} ${focus === s.id ? 'focus' : ''}`}>
              <button type="button" className="sp-head" onClick={() => onFocus(s.id)} aria-expanded={focus === s.id}>
                <span className="sp-name">{s.name}</span>
                <span className="sp-value" aria-label={`Priority ${s.value} of 5`}>{'●'.repeat(s.value)}<span>{'●'.repeat(5 - s.value)}</span></span>
              </button>
              <p className="micro sp-region">{s.region}</p>
              {focus === s.id && (
                <div className="sp-body">
                  <p><b>What:</b> {s.what}</p>
                  <p><b>Why it matters:</b> {s.why}</p>
                  <p className="sp-evidence"><Badge kind="nasa" /> {s.evidence}</p>
                  <p><b>Bring:</b> {s.bring} · <b>Time:</b> {s.minutes} min</p>
                </div>
              )}
              <button type="button" className={`btn btn-small sp-add ${on ? 'on' : ''}`} onClick={() => onAdd(s.id, !on)}>{on ? 'On the walk ✓' : 'Add to walk'}</button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------------- advisor ---------------- */
export function AdvisorPanel({ tips, onAction }) {
  return (
    <div className="ap">
      <p className="ap-label micro"><i aria-hidden="true" />{ADVISOR_LABEL}</p>
      {tips.length === 0 && <p className="ap-empty">Plan a walk to get advice.</p>}
      <ol className="ap-list">
        {tips.map((t) => (
          <li key={t.id}>
            <p>{t.text}</p>
            <p className="micro ap-rule">Rule: {t.rule}</p>
            {t.action === 'snap' && <button type="button" className="btn btn-small" onClick={() => onAction('snap')}>Do it</button>}
            {t.stop && <button type="button" className="btn btn-small" onClick={() => onAction('add', t.stop)}>Add stop</button>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------------- settings ---------------- */
export function SettingsPanel({ settings, onChange, date, onDate, sol, snap, onSnap }) {
  const set = useCallback((k) => (v) => onChange({ ...settings, [k]: v }), [settings, onChange])
  return (
    <div className="stp">
      <label className="stp-snap">
        <input type="checkbox" checked={snap} onChange={(e) => onSnap(e.target.checked)} />
        <span><b>Go around steep ground</b> when I draw my own walk</span>
      </label>
      <div className="stp-date">
        <label htmlFor="walk-date">Walk date (Earth calendar)</label>
        <input id="walk-date" type="date" value={date} min="2026-01-01" max="2035-12-31" onChange={(e) => e.target.value && onDate(e.target.value)} />
        <p className="micro">Mars day {sol.sol.toLocaleString()}{sol.Ls >= 180 ? ' · dust storm season' : ''}</p>
      </div>
      {Object.entries(WALK).map(([k, w]) => (
        <Slider compact key={k} id={`set-${k}`} label={w.label} value={settings[k]} min={w.min} max={w.max} step={w.step} unit={k === 'startHour' ? '' : w.unit} badge={w.badge} note={w.note} format={k === 'startHour' ? fmtHours : undefined} onChange={set(k)} />
      ))}
    </div>
  )
}

/* ---------------- manual ---------------- */
export function ManualPanel({ items }) {
  return (
    <div className="mp">
      {items.map((m, i) => (
        <SbDisclosure key={m.title} title={m.title} defaultOpen={i === 0}>
          {m.body.map((b) => <p key={b}>{b}</p>)}
        </SbDisclosure>
      ))}
      <p className="mp-more">Every dataset, method and limit: <Link to="/sources">Data &amp; sources</Link></p>
    </div>
  )
}
