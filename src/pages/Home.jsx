import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { SITE } from '../content/site.js'
import { globeTexture, siteById } from '../data/index.js'
import { marsTime, sunAt, fmtHours } from '../lib/mars24.js'
import { earthMars } from '../lib/ephem.js'
import { Badge } from '../components/Atoms.jsx'
import { useReducedMotion } from '../lib/hooks.js'
// The world map (MapLibre) is the heaviest code in the app, so it loads on its own: fetched in
// the background while the intro plays, and needed only once you head for Mars.
const loadExplorer = () => import('../components/Explorer.jsx')
const Explorer = lazy(loadExplorer)
import Orbits from '../components/Orbits.jsx'
import './home.css'

const SEASONS = ['Northern spring', 'Northern summer', 'Northern autumn', 'Northern winter']
const JEZERO = siteById('jezero')

/** Live figures for the mission strip, computed in the browser (Mars24 and the planets' orbits). */
function liveNow() {
  const now = Date.now()
  const t = marsTime(now)
  const em = earthMars(now)
  return {
    km: `${Math.round(em.km / 1e6)} million km`,
    msg: `${em.lightMin.toFixed(0)} min`,
    season: SEASONS[Math.floor((((t.Ls % 360) + 360) % 360) / 90)],
    jezero: fmtHours(sunAt(now, JEZERO.lat, JEZERO.lon, t).ltst),
  }
}

const seen = { intro: false } // skip the intro on return visits within the session

export default function Home() {
  const canvas = useRef(null)
  const space = useRef(null)
  const glow = useRef(null)
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState(seen.intro ? 'globe' : 'earth')
  const [failed, setFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [sceneGone, setSceneGone] = useState(seen.intro)
  const [live, setLive] = useState(liveNow)
  useEffect(() => {
    if (phase !== 'earth') return
    const id = setInterval(() => setLive(liveNow()), 1000)
    return () => clearInterval(id)
  }, [phase])

  // Opening scene (three.js). Not created at all on return visits.
  useEffect(() => {
    if (seen.intro) return
    let alive = true, api = null
    import('../three/space.js').then(({ createSpace }) => {
      if (!alive || !canvas.current) return
      try {
        api = createSpace(canvas.current, {
          texture: globeTexture,
          reducedMotion: reduced,
          onPhase: (p) => { setPhase(p); if (p === 'globe') seen.intro = true },
          onFrame: ({ phase: p, progress }) => {
            if (p === 'flight' && glow.current) {
              const k = progress > 0.8 ? Math.sin(((progress - 0.8) / 0.2) * Math.PI) : 0
              glow.current.style.opacity = String(k * 0.8)
            }
          },
        })
        space.current = api
        if (import.meta.env.DEV) window.__space = api
      } catch {
        setFailed(true)
      }
    }).catch(() => setFailed(true))
    return () => { alive = false; api?.dispose(); space.current = null }
  }, [reduced])

  // fetch the map code while the visitor reads the intro (after the headline has settled, and
  // only when the browser is idle, so the Earth animation never stutters)
  useEffect(() => {
    let id = null
    const t = setTimeout(() => {
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200))
      id = idle(() => loadExplorer().catch(() => {}), { timeout: 4000 })
    }, 2500)
    return () => { clearTimeout(t); if (id !== null) (window.cancelIdleCallback || clearTimeout)(id) }
  }, [])

  // Hand over from the 3D arrival to the map once the map has drawn, then free the GPU.
  useEffect(() => {
    if (phase !== 'globe' || !mapReady || sceneGone) return
    const t = setTimeout(() => { space.current?.dispose(); space.current = null; setSceneGone(true) }, 1600)
    return () => clearTimeout(t)
  }, [phase, mapReady, sceneGone])

  // Scroll, a key or a swipe begins the descent.
  useEffect(() => {
    if (phase !== 'earth') return
    const go = (e) => {
      if (e.type === 'keydown' && !['ArrowDown', ' ', 'PageDown'].includes(e.key)) return
      if (e.type === 'keydown' && e.target.closest('a,button,input')) return
      space.current?.begin()
    }
    window.addEventListener('wheel', go, { passive: true })
    window.addEventListener('touchmove', go, { passive: true })
    window.addEventListener('keydown', go)
    return () => { window.removeEventListener('wheel', go); window.removeEventListener('touchmove', go); window.removeEventListener('keydown', go) }
  }, [phase])

  // The flight never blocks: any click, key or scroll lands straight on the map.
  useEffect(() => {
    if (phase !== 'flight') return
    const land = (e) => {
      if (e.type === 'keydown' && ['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return
      space.current?.skip()
    }
    // armed a moment later, so the click that pressed Begin doesn't count
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', land)
      window.addEventListener('keydown', land)
      window.addEventListener('wheel', land, { passive: true })
    }, 300)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', land)
      window.removeEventListener('keydown', land)
      window.removeEventListener('wheel', land)
    }
  }, [phase])

  const begin = () => (space.current ? space.current.begin() : setPhase('globe'))
  const skip = () => (space.current ? space.current.skip() : setPhase('globe'))

  return (
    <div className={`home phase-${phase} ${failed ? 'nogl' : ''}`}>
      {!sceneGone && <canvas ref={canvas} className="home-canvas" aria-label="Earth, the Moon and Mars, drawn from NASA mission maps" role="img" />}
      <div className="home-glow" ref={glow} aria-hidden="true" />
      {failed && phase === 'earth' && <div className="home-fallback" aria-hidden="true"><Orbits label /></div>}

      <div className="hero-scrim" aria-hidden="true" />
      <section className="intro hero" aria-hidden={phase !== 'earth'} inert={phase !== 'earth'}>
        <div className="hero-center">
          <p className="hero-eyebrow">NASA Space Apps 2026<span className="hero-eyebrow-more"> · Martian Map challenge</span></p>
          <h1 className="hero-title">
            Plan a walk<br />on <span className="accent">another world.</span>
          </h1>
          <p className="hero-pitch">{SITE.pitchShort}</p>
          <div className="hero-cta">
            <button type="button" className="hero-launch" onClick={begin}>
              <span className="hero-launch-pulse" aria-hidden="true" />
              Launch to Mars
            </button>
            <button type="button" className="hero-skip" onClick={skip}>or go straight to the map <span aria-hidden="true">→</span></button>
          </div>
        </div>

        <div className="hero-strip">
          <dl>
            <div><dt>Mars is now</dt><dd>{live.km}</dd></div>
            <div><dt>Message to Earth</dt><dd>{live.msg}</dd></div>
            <div><dt>Season on Mars</dt><dd>{live.season}</dd></div>
            <div><dt>Time at Jezero</dt><dd>{live.jezero}</dd></div>
          </dl>
          <p className="hero-strip-note"><Badge kind="derived" /> Worked out live in your browser from NASA's Mars24 method and the planets' orbits.</p>
        </div>

        <p className="hero-credit">Earth at night: NASA Black Marble · Moon: NASA LRO · Mars: Viking</p>
      </section>

      {/* the map starts once the rocket is at Mars (setting it up mid-flight made the flight stutter);
          the 3D globe stays on screen until the map has drawn */}
      {phase === 'globe' && (
        <div className="home-map">
          <Suspense fallback={sceneGone ? <p className="home-loading" role="status"><i className="spinner" aria-hidden="true" />Loading the Mars map…</p> : null}>
            <Explorer visible onReady={() => setMapReady(true)} />
          </Suspense>
        </div>
      )}

      {phase === 'flight' && (
        <>
          <p className="flight-caption">Marswalk rocket · illustration, not to scale</p>
          <button type="button" className="btn btn-small flight-skip" onClick={skip}>Skip to the map</button>
        </>
      )}
    </div>
  )
}
