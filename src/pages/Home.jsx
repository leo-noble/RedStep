import { useEffect, useRef, useState } from 'react'
import { SITE } from '../content/site.js'
import { useReducedMotion } from '../lib/hooks.js'
import Explorer from '../components/Explorer.jsx'
import Orbits from '../components/Orbits.jsx'
import './home.css'

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

  // Opening scene (three.js). Not created at all on return visits.
  useEffect(() => {
    if (seen.intro) return
    let alive = true, api = null
    import('../three/space.js').then(({ createSpace }) => {
      if (!alive || !canvas.current) return
      try {
        api = createSpace(canvas.current, {
          base: import.meta.env.BASE_URL,
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

  const begin = () => (space.current ? space.current.begin() : setPhase('globe'))
  const skip = () => (space.current ? space.current.skip() : setPhase('globe'))

  return (
    <div className={`home phase-${phase} ${failed ? 'nogl' : ''}`}>
      {!sceneGone && <canvas ref={canvas} className="home-canvas" aria-label="Earth, the Moon and Mars, drawn from NASA mission maps" role="img" />}
      <div className="home-glow" ref={glow} aria-hidden="true" />
      {failed && phase === 'earth' && <div className="home-fallback" aria-hidden="true"><Orbits label /></div>}

      <section className="intro" aria-hidden={phase !== 'earth'} inert={phase !== 'earth'}>
        <p className="intro-kicker">NASA Space Apps 2026 · Martian Map</p>
        <h1 className="intro-title">
          Plan a walk<br />on <span className="serif">another world.</span>
        </h1>
        <p className="intro-pitch">{SITE.pitchShort}</p>
        <p className="intro-why">{SITE.whyJezero}</p>
        <div className="intro-cta">
          <button type="button" className="btn btn-primary" onClick={begin}>Begin descent <span className="arrow">↓</span></button>
          <button type="button" className="btn btn-ghost" onClick={skip}>Skip to Mars</button>
        </div>
      </section>

      {phase === 'flight' && <button type="button" className="btn btn-small flight-skip" onClick={skip}>Skip</button>}

      {phase === 'globe' && <Explorer visible onReady={() => setMapReady(true)} />}
    </div>
  )
}
