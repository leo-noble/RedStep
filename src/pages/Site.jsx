import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { siteById } from '../content/sites.js'
import { STOPS, HABITAT } from '../content/science.js'
import { WALK, FACTS } from '../content/assumptions.js'
import { LAYER_GROUPS } from '../content/layers.js'
import { instantAtLocalTime, marsTime } from '../lib/mars24.js'
import { paintElevation, paintSlope } from '../lib/marsmap.js'
import { advise } from '../lib/advisor.js'
import { useNarrow, prefersReducedMotion, store } from '../lib/hooks.js'
import { useEmergency } from '../components/Layout.jsx'
import MarsMap from '../components/planner/MarsMap.jsx'
import Profile from '../components/planner/Profile.jsx'
import { AdvisorPanel, LayerPanel, ManualPanel, SciencePanel, SettingsPanel, VerdictPanel } from '../components/planner/Panels.jsx'
import { Sidebar } from '../components/Sidebar.jsx'
import { MANUAL } from '../content/manual.js'
import { Verdict } from '../components/Atoms.jsx'
import { fmtH, pct } from '../compute/walk.js'
import LiteSite from './LiteSite.jsx'
import NotFound from './NotFound.jsx'
import './site.css'

const BASE = import.meta.env.BASE_URL
const DEFAULTS = Object.fromEntries(Object.entries(WALK).map(([k, v]) => [k, v.value]))
const FACT_VALUES = Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, v.value]))
const ALL_LAYERS = LAYER_GROUPS.flatMap((g) => g.layers)
const today = () => new Date().toISOString().slice(0, 10)
const APPETITE = [
  { id: 'careful', label: 'Short', value: 0.6, note: 'A short, careful walk: uses at most 60% of the usable suit air' },
  { id: 'balanced', label: 'Medium', value: 0.85, note: 'Uses at most 85% of the usable suit air' },
  { id: 'bold', label: 'Long', value: 1, note: 'Uses all the usable suit air (the safety reserve is always kept)' },
]

// URL state: ?w=lon,lat;lon,lat&snap=1&stops=a,b&d=2026-10-24&t=9
const encodePts = (pts) => pts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';')
const decodePts = (s) => (s ? s.split(';').map((q) => q.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)) : null)

export default function Site() {
  const { id } = useParams()
  const site = siteById(id)
  if (!site) return <NotFound />
  if (!site.planner) return <LiteSite site={site} />
  return <Planner site={site} />
}

function Planner({ site }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const emergency = useEmergency()
  const mapRef = useRef(null)
  const worker = useRef(null)
  const reqId = useRef(0)
  const habitat = useMemo(() => [HABITAT.lon, HABITAT.lat], [])
  const stops = STOPS[site.id] || []

  const [meta, setMeta] = useState(null)
  const [grid, setGrid] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState(null)
  const [layers, setLayers] = useState(() => Object.fromEntries(ALL_LAYERS.map((l) => [l.id, { on: l.on, opacity: l.opacity }])))
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...store.get('mw-settings-v2', {}), ...(params.get('t') ? { startHour: Number(params.get('t')) } : {}) }))
  const [date, setDate] = useState(params.get('d') || today())
  const [waypoints, setWaypoints] = useState(() => decodePts(params.get('w')) || [habitat])
  const [snap, setSnap] = useState(params.get('snap') === '1')
  const [stopIds, setStopIds] = useState(() => (params.get('stops') ? params.get('stops').split(',') : []))
  const [drawing, setDrawing] = useState(false)
  const [appetite, setAppetite] = useState('balanced')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rightTab, setRightTab] = useState('verdict')
  const [leftTab, setLeftTab] = useState('layers')
  const [sbOpen, setSbOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const [sheet, setSheet] = useState('verdict')
  const [sheetOpen, setSheetOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 820)
  const [focusStop, setFocusStop] = useState(null)
  const [following, setFollowing] = useState(false)
  const [suggestNote, setSuggestNote] = useState(null)
  const hud = useRef(null)
  const stopFollow = useRef(null)

  useEffect(() => {
    if (!drawing) return
    setHint(true)
    const t = setTimeout(() => setHint(false), 4500)
    return () => clearTimeout(t)
  }, [drawing])

  const startMs = useMemo(() => instantAtLocalTime(Date.parse(`${date}T12:00:00Z`), site.lon, settings.startHour), [date, settings.startHour, site.lon])
  const sol = useMemo(() => marsTime(startMs), [startMs])
  useEffect(() => { store.set('mw-settings-v2', settings) }, [settings])

  // ---- worker ----
  useEffect(() => {
    const w = new Worker(new URL('../compute/worker.js', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = ({ data }) => {
      if (data.type === 'ready') { setMeta((m) => m || data.meta); setGrid({ w: data.w, h: data.h, slope: data.slope, elev: data.elev, dx: data.dx, dy: data.dy }) }
      else if (data.type === 'error') { setError(data.message); setBusy(false) }
      else if (data.id === reqId.current) handleResult(data)
    }
    w.onerror = (e) => setError(e.message || 'Worker failed')
    w.postMessage({ type: 'init', site: site.id, base: new URL(BASE, location.href).href })
    fetch(`${BASE}data/${site.id}/meta.json`).then((r) => r.json()).then((d) => setMeta((m) => m || d)).catch(() => setError('Map data missing. Run npm run bake.'))
    return () => w.terminate()
  }, [site.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResult = useCallback((data) => {
    setBusy(false)
    if (data.type === 'suggest') {
      if (!data.line) { setSuggestNote('No stop fits the air and daylight with these settings. Try "Bold", an earlier start, or a smaller reserve.'); return }
      setSuggestNote(null)
      setStopIds(data.chosen)
      setSnap(true)
      setWaypoints(data.waypoints)
      setResult({ line: data.line, analysis: data.analysis })
      animateRoute(data.line, data.waypoints)
      mapRef.current?.fitRoute(data.line)
    } else {
      setResult({ line: data.line, analysis: data.analysis })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const waypointsRef = useRef(waypoints)
  waypointsRef.current = waypoints
  const skipPlan = useRef(false)

  // Draw the route on progressively (rAF + direct source writes, no re-renders).
  const animateRoute = useCallback((line, wps) => {
    const m = mapRef.current
    if (!m) return
    if (prefersReducedMotion()) { m.setRoute(line, wps); return }
    skipPlan.current = true
    animating.current = true
    const t0 = performance.now(), ms = 2000
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 // ease in-out: slow start, slow finish
      const n = Math.max(2, Math.ceil(line.length * e))
      m.setRoute(line.slice(0, n), k === 1 ? wps : wps.slice(0, 1))
      if (k < 1) requestAnimationFrame(step)
      else animating.current = false
    }
    requestAnimationFrame(step)
  }, [])
  const animating = useRef(false)

  // Keep the drawn route in step with the latest result (after the map is ready).
  useEffect(() => {
    if (!mapReady || animating.current) return
    mapRef.current?.setRoute(result?.line || null, waypoints)
  }, [mapReady, result, waypoints])

  // ---- plan whenever inputs change ----
  const planStops = useMemo(() => stops.filter((s) => stopIds.includes(s.id)), [stops, stopIds])
  useEffect(() => {
    if (!grid) return
    if (skipPlan.current) { skipPlan.current = false; return }
    if (waypoints.length < 2) { setResult(null); mapRef.current?.setRoute(null, waypoints); return }
    const id = ++reqId.current
    setBusy(true)
    worker.current.postMessage({
      type: 'plan', id, waypoints, snap: waypoints.slice(1).map(() => snap), stops: planStops,
      settings, startMs, site, habitat, facts: FACT_VALUES,
    })
  }, [grid, waypoints, snap, planStops, settings, startMs, site, habitat])

  // ---- URL ----
  useEffect(() => {
    const p = new URLSearchParams()
    if (waypoints.length > 1) p.set('w', encodePts(waypoints))
    if (snap) p.set('snap', '1')
    if (stopIds.length) p.set('stops', stopIds.join(','))
    if (date !== today()) p.set('d', date)
    if (settings.startHour !== DEFAULTS.startHour) p.set('t', String(settings.startHour))
    setParams(p, { replace: true })
  }, [waypoints, snap, stopIds, date, settings.startHour, setParams])

  // ---- paint derived layers once the grid arrives / thresholds change ----
  useEffect(() => {
    if (!grid || !meta || !mapReady) return
    let gone = false, url
    paintElevation(grid, meta.grid.min, meta.grid.max).then((u) => { if (gone) return URL.revokeObjectURL(u); url = u; mapRef.current?.setImage('elevation', u) })
    return () => { gone = true; if (url) setTimeout(() => URL.revokeObjectURL(url), 2000) }
  }, [grid, meta, mapReady])
  useEffect(() => {
    if (!grid || !mapReady) return
    let gone = false, url
    paintSlope(grid, settings.greenSlope, settings.redSlope).then((u) => { if (gone) return URL.revokeObjectURL(u); url = u; mapRef.current?.setImage('slope', u) })
    return () => { gone = true; if (url) setTimeout(() => URL.revokeObjectURL(url), 2000) }
  }, [grid, mapReady, settings.greenSlope, settings.redSlope])

  // static overlays
  useEffect(() => {
    if (!mapReady) return
    fetch(`${BASE}data/${site.id}/perseverance.json`).then((r) => r.json()).then((p) => mapRef.current?.setTraverse(p.line)).catch(() => {})
  }, [mapReady, site.id])
  const visited = result?.analysis?.visited.map((v) => v.id) || []
  useEffect(() => { if (mapReady) mapRef.current.setStops(stops, visited) }, [mapReady, stops, visited.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mapReady) mapRef.current.setRadius(habitat[0], habitat[1], settings.walkBack * 1000) }, [mapReady, habitat, settings.walkBack])
  useEffect(() => {
    if (!mapReady) return
    const a = result?.analysis
    mapRef.current.setMarkers({ habitat, turnBack: a ? [a.turnBack.lon, a.turnBack.lat] : null, maxSlope: a && a.maxSlope > settings.greenSlope ? a.maxSlopeAt : null })
  }, [mapReady, result, habitat, settings.greenSlope])
  useEffect(() => {
    if (!mapReady) return
    for (const [lid, st] of Object.entries(layers)) mapRef.current.setLayer(lid, st.on, st.opacity)
  }, [mapReady, layers])

  // ---- actions ----
  const suggest = useCallback((which = appetite) => {
    if (!grid) return
    setDrawing(false)
    const id = ++reqId.current
    setBusy(true)
    worker.current.postMessage({ type: 'suggest', id, habitat, stops, settings, startMs, site, facts: FACT_VALUES, appetite: APPETITE.find((a) => a.id === which).value })
  }, [grid, appetite, habitat, stops, settings, startMs, site])

  const onMapClick = useCallback((p, stopId) => {
    if (!drawing) return
    const s = stopId && stops.find((x) => x.id === stopId)
    setWaypoints((w) => [...w, s ? [s.lon, s.lat] : p])
    if (s) setStopIds((ids) => (ids.includes(s.id) ? ids : [...ids, s.id]))
  }, [drawing, stops])

  const onWaypointDrag = useCallback((i, p) => setWaypoints((w) => w.map((q, k) => (k === i ? p : q))), [])

  const toggleStop = useCallback((sid, on) => {
    const s = stops.find((x) => x.id === sid)
    if (!s) return
    if (on) {
      setStopIds((ids) => [...ids, sid])
      setWaypoints((w) => [...w, [s.lon, s.lat]])
    } else {
      setStopIds((ids) => ids.filter((x) => x !== sid))
      setWaypoints((w) => w.filter((q, k) => k === 0 || Math.hypot(q[0] - s.lon, q[1] - s.lat) > 1e-5))
    }
  }, [stops])

  const clear = () => { setWaypoints([habitat]); setStopIds([]); setResult(null); setSuggestNote(null); mapRef.current?.setRoute(null, [habitat]) }
  const undo = () => setWaypoints((w) => (w.length > 1 ? w.slice(0, -1) : w))

  const onFix = (what) => {
    if (what === 'snap') setSnap(true)
    if (what === 'early') setSettings((s) => ({ ...s, startHour: 8 }))
    if (what === 'trim' && result) {
      const a = result.analysis
      const tb = [a.turnBack.lon, a.turnBack.lat]
      // keep waypoints before the turn-back distance, then end at the turn-back point
      const keep = [waypoints[0]]
      let d = 0
      for (let k = 1; k < waypoints.length; k++) {
        const q = a.profile.reduce((best, p) => (Math.hypot(p[3] - waypoints[k][0], p[4] - waypoints[k][1]) < Math.hypot(best[3] - waypoints[k][0], best[4] - waypoints[k][1]) ? p : best))
        d = q[0]
        if (d < a.turnBack.d) keep.push(waypoints[k])
      }
      keep.push(tb)
      setWaypoints(keep)
      setStopIds((ids) => ids.filter((sid) => keep.some((q) => { const s = stops.find((x) => x.id === sid); return s && Math.hypot(q[0] - s.lon, q[1] - s.lat) < 1e-5 })))
    }
  }

  const follow = () => {
    if (!result?.analysis || following) return
    setFollowing(true)
    setSheetOpen(false)
    mapRef.current.setLayer('slope', layers.slope.on, Math.min(layers.slope.opacity, 0.22))
    const prof = result.analysis.profile
    stopFollow.current = mapRef.current.follow(prof, (i, d) => {
      const el = hud.current
      if (!el) return
      const p = prof[i]
      el.querySelector('[data-k=d]').textContent = `${(d / 1000).toFixed(2)} km`
      el.querySelector('[data-k=t]').textContent = fmtH(p[5])
      el.querySelector('[data-k=z]').textContent = `${Math.round(p[1])} m`
      el.querySelector('[data-k=s]').textContent = `${p[2].toFixed(1)}°`
      el.querySelector('[data-k=a]').textContent = pct(1 - p[6])
    }, () => setTimeout(endFollow, 1200))
  }
  const endFollow = () => { stopFollow.current?.(); stopFollow.current = null; setFollowing(false); mapRef.current?.setLayer('slope', layers.slope.on, layers.slope.opacity); if (result) mapRef.current?.fitRoute(result.line) }
  useEffect(() => () => stopFollow.current?.(), [])

  const exportBrief = async () => {
    if (!result) return
    const snapshot = await mapRef.current?.snapshot(result.line)
    const payload = { site: site.id, result, waypoints, settings, date, startMs, stopIds: visited, snapshot, url: location.href, made: Date.now() }
    try { sessionStorage.setItem('mw-brief', JSON.stringify(payload)) } catch { /* too big: brief falls back to no map image */ try { sessionStorage.setItem('mw-brief', JSON.stringify({ ...payload, snapshot: null })) } catch { /* ignore */ } }
    navigate('/brief')
  }

  const score = useMemo(() => {
    const total = stops.reduce((s, p) => s + p.value, 0)
    const got = stops.filter((p) => visited.includes(p.id)).reduce((s, p) => s + p.value, 0)
    return { total, got }
  }, [stops, visited])
  const tips = useMemo(() => advise(result?.analysis, { settings, stops, startMs, site, visitedIds: visited, snap }), [result, settings, stops, startMs, site, visited, snap])

  const onAdvisor = (what, sid) => { if (what === 'snap') setSnap(true); if (what === 'add') toggleStop(sid, true) }
  const onHover = useCallback((p) => mapRef.current?.setHover(p ? [p[3], p[4]] : null), [])

  if (error) {
    return (
      <div className="site-error">
        <p className="micro">Map data</p>
        <h1>{error}</h1>
        <Link to="/" className="btn">Back to the globe</Link>
      </div>
    )
  }

  const a = result?.analysis
  const verdict = <VerdictPanel analysis={a} settings={settings} snap={snap} busy={busy} onFix={onFix} onEmergency={(f) => emergency.open(f)} visitedCount={visited.length} />
  const science = <SciencePanel stops={stops} visited={visited} onAdd={toggleStop} onFocus={(sid) => setFocusStop((f) => (f === sid ? null : sid))} focus={focusStop} score={score} />
  const advisor = <AdvisorPanel tips={tips} onAction={onAdvisor} />
  const layerPanel = <LayerPanel groups={LAYER_GROUPS} state={layers} onToggle={(lid, on) => setLayers((L) => ({ ...L, [lid]: { ...L[lid], on } }))} onOpacity={(lid, o) => setLayers((L) => ({ ...L, [lid]: { ...L[lid], opacity: o } }))} />
  const settingsPanel = <SettingsPanel settings={settings} onChange={setSettings} date={date} onDate={setDate} sol={sol} snap={snap} onSnap={setSnap} />

  return (
    <div className={`planner ${following ? 'following' : ''} ${drawing ? 'drawing' : ''} ${sbOpen || narrow ? '' : 'sb-closed'}`}>
      {meta && <MarsMap ref={mapRef} base={BASE} meta={meta} grid={grid} layers={ALL_LAYERS} drawing={drawing} onReady={() => setMapReady(true)} onMapClick={onMapClick} onWaypointDrag={onWaypointDrag} onStopClick={(sid) => { setFocusStop(sid); narrow ? (setSheet('science'), setSheetOpen(true)) : setRightTab('science') }} />}
      {!grid && <div className="planner-loading"><span className="micro">Loading the Jezero height map · MRO CTX</span></div>}

      {/* action bar */}
      <div className="actionbar glass" role="toolbar" aria-label="Walk tools">
        <button type="button" className="btn btn-primary ab-main" onClick={() => suggest()} disabled={!grid || busy}>
          {busy ? 'Finding a safe path…' : a ? 'Suggest another walk' : 'Suggest a safe walk'}
        </button>
        <div className="ab-appetite" role="radiogroup" aria-label="Walk length">
          {APPETITE.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={appetite === x.id} title={x.note} onClick={() => { setAppetite(x.id); if (result) suggest(x.id) }}>{x.label}</button>
          ))}
        </div>
        <span className="ab-or">or</span>
        <button type="button" className={`btn btn-small ${drawing ? 'on' : ''}`} aria-pressed={drawing} onClick={() => setDrawing((d) => !d)}>{drawing ? 'Done drawing' : 'Draw my own'}</button>
        {(drawing || waypoints.length > 1) && (
          <>
            <button type="button" className="btn btn-small ab-icon" onClick={undo} disabled={waypoints.length < 2} aria-label="Undo last point" title="Undo last point">↶</button>
            <button type="button" className="btn btn-small ab-icon" onClick={clear} disabled={waypoints.length < 2} aria-label="Start over" title="Start over">×</button>
          </>
        )}
        {a && (
          <span className="ab-after">
            <button type="button" className="btn btn-small" onClick={follow}>Fly along in 3D</button>
            <button type="button" className="btn btn-small ab-brief" onClick={exportBrief}>Save the plan <span className="arrow">→</span></button>
          </span>
        )}
      </div>
      {drawing && hint && <p className="draw-hint" role="status">Tap the map to add stops on your walk</p>}
      {suggestNote && <p className="draw-hint draw-warn">{suggestNote}</p>}

      {!narrow ? (
        <>
          <Sidebar
            open={sbOpen}
            onToggle={() => setSbOpen((o) => !o)}
            title={site.name}
            label="Map layers, settings and manual"
            className="planner-sb"
            header={(
              <div className="seg-ctl" role="tablist" aria-label="Sidebar">
                {[['layers', 'Map layers'], ['settings', 'Settings'], ['manual', 'Help']].map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={leftTab === k} onClick={() => setLeftTab(k)}>{l}</button>
                ))}
              </div>
            )}
          >
            {leftTab === 'layers' ? layerPanel : leftTab === 'settings' ? settingsPanel : <ManualPanel items={MANUAL.planner} />}
          </Sidebar>
          <aside className="side side-right glass" aria-label="Walk verdict, science and advice">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={rightTab === 'verdict'} onClick={() => setRightTab('verdict')}>Answer</button>
              <button role="tab" aria-selected={rightTab === 'science'} onClick={() => setRightTab('science')}>Science <span className="tab-count">{visited.length}</span></button>
              <button role="tab" aria-selected={rightTab === 'advisor'} onClick={() => setRightTab('advisor')}>Tips</button>
            </div>
            <div className="side-body">{rightTab === 'verdict' ? verdict : rightTab === 'science' ? science : advisor}</div>
          </aside>
          {a && <div className="profile-dock glass"><p className="pf-title">Up and down along the walk</p><Profile analysis={a} stops={stops} onHover={onHover} limits={settings} /></div>}
        </>
      ) : (
        <div className={`sheet ${sheetOpen ? 'open' : ''}`}>
          <button type="button" className="sheet-grip" aria-expanded={sheetOpen} onClick={() => setSheetOpen((o) => !o)}>
            <span aria-hidden="true" />
            {a ? <><Verdict status={a.status} /> <span className="micro">{(a.tripDistance / 1000).toFixed(1)} km · {fmtH(a.hours)}</span></> : <span className="sheet-label">Your walk</span>}
          </button>
          <div className="tabs" role="tablist">
            {[['verdict', 'Answer'], ['science', 'Science'], ['profile', 'Hills'], ['advisor', 'Tips'], ['more', 'More']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={sheet === k} onClick={() => { setSheet(k); setSheetOpen(true) }}>{l}</button>
            ))}
          </div>
          <div className="sheet-body">
            {sheet === 'verdict' && verdict}
            {sheet === 'science' && science}
            {sheet === 'profile' && <Profile analysis={a} stops={stops} onHover={onHover} limits={settings} />}
            {sheet === 'advisor' && advisor}
            {sheet === 'more' && (
              <>
                <div className="seg-ctl sheet-seg" role="tablist" aria-label="More">
                  {[['layers', 'Map layers'], ['settings', 'Settings'], ['manual', 'Help']].map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={leftTab === k} onClick={() => setLeftTab(k)}>{l}</button>
                  ))}
                </div>
                {leftTab === 'layers' ? layerPanel : leftTab === 'settings' ? settingsPanel : <ManualPanel items={MANUAL.planner} />}
              </>
            )}
          </div>
        </div>
      )}

      {following && a && (
        <div className="follow-hud" ref={hud} aria-live="off">
          <div><span className="micro">Distance</span><b data-k="d">0.00 km</b></div>
          <div><span className="micro">Time out</span><b data-k="t">0 min</b></div>
          <div><span className="micro">Height</span><b data-k="z">—</b></div>
          <div><span className="micro">Slope</span><b data-k="s">—</b></div>
          <div><span className="micro">Suit air left</span><b data-k="a">100%</b></div>
          <button type="button" className="btn btn-small" onClick={endFollow}>Stop</button>
          <p className="micro follow-note">Heights ×2 for clarity · 3D terrain from the MRO CTX height map</p>
        </div>
      )}
    </div>
  )
}
