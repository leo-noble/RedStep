import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import MarsGlobeHero from './MarsGlobeHero.jsx';
import Badge from './Badge.jsx';
import HomeSections from './HomeSections.jsx';
import { PANORAMAS } from '../content/panoramas.js';
import { deviceTier } from '../lib/quality.js';
import { createMotionEngine, windowed, smoothstep } from './motionEngine.js';
import { marsTime, localSolarTime, solarElevation, earthMarsLightTime, formatHM } from './mars24.js';
import { HOME, SITE, LANDING_SITES, DEFAULT_SITE_ID, CONSTANTS, SLOPE_THRESHOLDS, EVA_DEFAULTS, getSite } from './content.js';
import './boundary.css';
import './home.css';
import './annual.css';

const CHAPTER_WINDOWS = {
  hero: [-1, -0.5, 0.2, 0.27],
  layers: [2, 2, 2, 2],
  cruise: [0.3, 0.36, 0.56, 0.62],
  arrive: [0.63, 0.68, 0.76, 0.82],
  choose: [0.84, 0.91, 2, 3],
};
const VANZYL = PANORAMAS.find((p) => p.id === 'vanzyl');
const RAIL = [0, 0.4, 0.7, 0.95];
// The end of the story is the real Mars map: the same component as the /map page.
const Explorer = lazy(() => import('../components/Explorer.jsx'));

export default function HomePage() {
  const [engine] = useState(() => createMotionEngine());
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const heroRef = useRef(null);
  const tele = useRef({});
  // mapOn: the Mars map is loaded (from the cruise on, so it is ready on arrival)
  // atMars: the rocket has arrived and the map is showing; mapReady: its first frame is drawn
  const [mapOn, setMapOn] = useState(false);
  const [atMars, setAtMars] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  /* Engine → CSS variables (no React renders per frame) */
  useEffect(() => {
    const root = rootRef.current;
    engine.attach(trackRef.current);
    if (import.meta.env.DEV) window.__marswalk = engine;

    // The story sits below the first screen, so the rocket is already on its way when it arrives.
    engine.skipIntro();

    let lastChoose = null;
    let lastIntroDone = null;
    let lastRail = -1;
    const railItems = root.querySelectorAll('[data-rail]');
    const chapterEls = [...root.querySelectorAll('[data-chapter]')].map((el) => ({ el, key: el.dataset.chapter, on: null }));
    const unsub = engine.subscribe((s) => {
      const p = s.progress;
      const st = root.style;
      st.setProperty('--p', p.toFixed(4));
      st.setProperty('--intro', s.intro.toFixed(4));
      const w = {};
      for (const key of Object.keys(CHAPTER_WINDOWS)) {
        w[key] = windowed(p, ...CHAPTER_WINDOWS[key]);
        st.setProperty(`--w-${key}`, w[key].toFixed(4));
      }
      for (const c of chapterEls) {
        const on = w[c.key] > 0.3;
        if (on !== c.on) {
          c.el.dataset.on = on ? 'true' : 'false';
          c.on = on;
        }
      }
      if (p > 0.6) setMapOn(true);
      st.setProperty('--thrust', smoothstep(0.42, 0.66, s.intro).toFixed(3));

      const choose = p > 0.88;
      if (choose !== lastChoose) {
        root.dataset.choose = choose ? 'true' : 'false';
        lastChoose = choose;
        setAtMars(choose);
      }
      const introDone = s.intro >= 1;
      if (introDone !== lastIntroDone) {
        root.dataset.introDone = introDone ? 'true' : 'false';
        lastIntroDone = introDone;
        if (introDone) {
          try {
            sessionStorage.setItem('mw:intro', '1');
          } catch {
            /* storage unavailable */
          }
        }
      }
      let rail = 0;
      for (let i = 0; i < RAIL.length; i++) if (p >= RAIL[i] - 0.06) rail = i;
      if (rail !== lastRail) {
        railItems.forEach((el, i) => (el.dataset.state = i < rail ? 'done' : i === rail ? 'current' : 'next'));
        lastRail = rail;
      }
    });
    return () => {
      unsub();
      engine.destroy();
    };
  }, [engine]);

  /* Mars24 telemetry: plain text writes once per second */
  useEffect(() => {
    const t = tele.current;
    const write = (key, text) => {
      const el = t[key];
      if (el && el.textContent !== text) el.textContent = text;
    };
    const tick = () => {
      const m = marsTime();
      const lt = earthMarsLightTime();
      const site = getSite(DEFAULT_SITE_ID);
      write('season', m.season);
      write('light', `${lt.minutes.toFixed(1)} min`);
      write('lightBig', lt.minutes.toFixed(1));
      write('lightBand', lt.minutes.toFixed(1));
      write('siteName', site.name.split(' ·')[0]);
      write('ltst', formatHM(localSolarTime(m, site.lon)));
      const el = solarElevation(m, site.lat, site.lon);
      write('daynight', el > 0 ? 'in daylight' : el > -6 ? 'in twilight' : 'at night');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // While the map covers the 3D scene, the scene stops drawing.
  useEffect(() => {
    heroRef.current?.setPaused(atMars && mapReady);
  }, [atMars, mapReady]);

  // Fetch the Mars map and planner code in the background while the intro plays (not on weak
  // devices: holding the map code next to the 3D scene costs memory they don't have).
  useEffect(() => {
    if (deviceTier() === 'low') return undefined;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
    const id = idle(() => {
      import('../pages/MapPage.jsx').catch(() => {});
      import('../components/Explorer.jsx').catch(() => {});
      import('../pages/Site.jsx').catch(() => {});
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);

  const ref = (k) => (el) => {
    tele.current[k] = el;
  };

  return (
    <div className="mw-home" ref={rootRef} data-choose="false" data-intro-done="true">
      {/* ---- First screen: a board of tiles. The name, Perseverance's own view of Jezero, what
           Redstep does, and Jezero right now (worked out in the browser). ---- */}
      <header className="board" aria-labelledby="home-title">
        <div className="board__name">
          <h1 id="home-title">{SITE.name}</h1>
        </div>
        <figure className="board__pic board__pic--a shutter">
          <img src="/data/panoramas/vanzyl-3k.webp" alt={VANZYL.alt} width="3000" height="1500" fetchPriority="high" />
        </figure>
        <figure className="board__pic board__pic--b">
          <img src="/data/panoramas/vanzyl-3k.webp" alt="" width="3000" height="1500" />
        </figure>
        <div className="board__say">
          <p>{HOME.boardSay}</p>
          <div className="board__actions">
            <Link to="/site/jezero" className="btn btn--primary">
              {HOME.ctaWalk} <span aria-hidden="true">→</span>
            </Link>
            <Link to="/map" className="board__link">
              {HOME.ctaMap}
            </Link>
          </div>
        </div>
        <div className="board__now" aria-live="off">
          <p>
            Right now at Jezero Crater it is <b ref={ref('ltst')}>—</b> Mars time, <span ref={ref('daynight')}>—</span>. A radio message to Earth takes{' '}
            <b ref={ref('light')}>—</b>.
          </p>
          <Badge kind="derived" source="mars24" align="end" note={HOME.telemetryNote} />
        </div>
      </header>

      <section className="story" ref={trackRef} aria-labelledby="story-title">
        <div className="stage">
          <MarsGlobeHero ref={heroRef} engine={engine} sites={LANDING_SITES} />
          <div className="stage-veil" aria-hidden="true" />

          {/* ---- 01 · Leave Earth ---- */}
          <div className="chapter chapter--left" data-chapter="hero" style={{ '--w': 'var(--w-hero)' }}>
            <h2 className="h2" id="story-title">{HOME.story.launch.title}</h2>
            <p className="body">{HOME.story.launch.body}</p>
          </div>

          {/* ---- 02 · Cruise ---- */}
          <div className="chapter chapter--left" data-chapter="cruise" style={{ '--w': 'var(--w-cruise)' }}>
            <h2 className="h2">{HOME.story.cruise.title}</h2>
            <p className="body">{HOME.story.cruise.body}</p>
            <div className="stats">
              <Stat value={CONSTANTS.radCruise.value} unit={CONSTANTS.radCruise.unit} label="A day in deep space, measured by Curiosity's RAD" badge={<Badge kind="nasa" source="rad" />} />
              <Stat value={CONSTANTS.radSurface.value} unit={CONSTANTS.radSurface.unit} label="A day on the surface of Mars, same instrument" badge={<Badge kind="nasa" source="rad" />} />
            </div>
          </div>

          {/* ---- 03 · Arrive ---- */}
          <div className="chapter chapter--left" data-chapter="arrive" style={{ '--w': 'var(--w-arrive)' }}>
            <h2 className="h2">{HOME.story.arrive.title}</h2>
            <p className="body">{HOME.story.arrive.body}</p>
            <ul className="slope-legend" aria-label="Default slope limits">
              <li className="slope slope--go">
                <b>Under {SLOPE_THRESHOLDS.go}°</b>
                <span>GO</span>
              </li>
              <li className="slope slope--caution">
                <b>
                  {SLOPE_THRESHOLDS.go}–{SLOPE_THRESHOLDS.caution}°
                </b>
                <span>CAUTION</span>
              </li>
              <li className="slope slope--nogo">
                <b>Over {SLOPE_THRESHOLDS.caution}°</b>
                <span>NO-GO</span>
              </li>
            </ul>
            <p className="fine">
              Walk-back radius {EVA_DEFAULTS.walkBackRadiusKm} km and a {Math.round(EVA_DEFAULTS.reserveFraction * 100)} % air reserve, both
              yours to change <Badge kind="illustrative" source="assumption" note="Thresholds and suit budgets are engineering assumptions you can change in the planner." />
            </p>
          </div>

          {/* ---- 04 · Arrival: the real Mars map takes over (the same one as /map) ---- */}
          {mapOn && (
            <div className={`home-map ${atMars ? 'on' : ''}`} data-ui inert={!atMars} aria-hidden={!atMars}>
              <Suspense fallback={null}>
                <Explorer visible={atMars} embedded onReady={() => setMapReady(true)} />
              </Suspense>
            </div>
          )}

          {/* ---- Where you are in the trip ---- */}
          <nav className="rail" aria-label="The trip">
            {HOME.chapters.map((c, i) => (
              <button key={c.id} type="button" className="rail__item" data-rail data-state="next" onClick={() => engine.scrollToProgress(RAIL[i] + (i === 3 ? 0.02 : 0))}>
                <span className="rail__label">{c.label}</span>
              </button>
            ))}
          </nav>

          <p className="schematic-note">
            Drawn to explain, not to scale <Badge kind="illustrative" source="schematic" align="end" />
          </p>
        </div>
      </section>

      <HomeSections teleRef={ref} />
    </div>
  );
}

function Stat({ value, valueRef, unit, label, badge }) {
  return (
    <div className="stat">
      <p className="stat__value">
        <span ref={valueRef}>{value ?? '—'}</span>
        <small>{unit}</small>
      </p>
      <p className="stat__label">{label}</p>
      {badge}
    </div>
  );
}
