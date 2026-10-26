import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import MarsGlobeHero from './MarsGlobeHero.jsx';
import { fmtLat, fmtLon } from './format.js';
import Badge from './Badge.jsx';
import FeatureArt from './FeatureArt.jsx';
import { deviceTier } from '../lib/quality.js';
import { createMotionEngine, windowed, smoothstep } from './motionEngine.js';
import { marsTime, localSolarTime, solarElevation, earthMarsLightTime, formatHM } from './mars24.js';
import { FOOTER_NAV } from '../content/site.js';
import { HOME, SITE, LANDING_SITES, DEFAULT_SITE_ID, SOURCES, CONSTANTS, SLOPE_THRESHOLDS, EVA_DEFAULTS, getSite } from './content.js';
import './boundary.css';
import './home.css';

const CHAPTER_WINDOWS = {
  hero: [-1, -0.5, 0.07, 0.14],
  layers: [0.15, 0.21, 0.33, 0.39],
  cruise: [0.4, 0.46, 0.56, 0.62],
  arrive: [0.63, 0.68, 0.76, 0.82],
  choose: [0.84, 0.91, 2, 3],
};
const RAIL = [0, 0.27, 0.51, 0.95];

export default function HomePage() {
  const [engine] = useState(() => createMotionEngine());
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const heroRef = useRef(null);
  const tele = useRef({});
  const [selectedId, setSelectedId] = useState(DEFAULT_SITE_ID);
  const [lighting, setLighting] = useState('day');
  const selected = getSite(selectedId);

  /* Engine → CSS variables (no React renders per frame) */
  useEffect(() => {
    const root = rootRef.current;
    engine.attach(trackRef.current);
    if (import.meta.env.DEV) window.__marswalk = engine;

    let seen = false;
    try {
      seen = sessionStorage.getItem('mw:intro') === '1';
    } catch {
      /* storage unavailable */
    }
    if (seen || window.scrollY > 8) engine.skipIntro();
    else engine.playIntro();

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
      for (const c of chapterEls) {
        const w = windowed(p, ...CHAPTER_WINDOWS[c.key]);
        st.setProperty(`--w-${c.key}`, w.toFixed(4));
        const on = w > 0.3;
        if (on !== c.on) {
          c.el.dataset.on = on ? 'true' : 'false';
          c.on = on;
        }
      }
      st.setProperty('--thrust', smoothstep(0.42, 0.66, s.intro).toFixed(3));

      const choose = p > 0.88;
      if (choose !== lastChoose) {
        root.dataset.choose = choose ? 'true' : 'false';
        lastChoose = choose;
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
      const site = getSite(selectedId);
      write('season', m.season);
      write('light', `${lt.minutes.toFixed(1)} min`);
      write('lightBig', lt.minutes.toFixed(1));
      write('lightBand', lt.minutes.toFixed(1));
      write('siteName', site.name.split(' ·')[0]);
      write('ltst', `${formatHM(localSolarTime(m, site.lon))} local time`);
      const el = solarElevation(m, site.lat, site.lon);
      write('daynight', el > 0 ? 'Daylight' : el > -6 ? 'Twilight' : 'Night');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [selectedId]);

  useEffect(() => {
    heroRef.current?.setLighting(lighting);
  }, [lighting]);

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

  const goChoose = () => engine.scrollToProgress(0.97);
  const commit = (id) => {
    setSelectedId(id);
    if (heroRef.current?.isInteractive()) heroRef.current.flyTo(id);
    else navigate(`/site/${id}`);
  };
  const ref = (k) => (el) => {
    tele.current[k] = el;
  };

  return (
    <div className="mw-home" ref={rootRef} data-choose="false" data-intro-done="false">
      <section className="story" ref={trackRef} aria-label="Marswalk Planner introduction">
        <div className="stage">
          <MarsGlobeHero
            ref={heroRef}
            engine={engine}
            sites={LANDING_SITES}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onArrive={(id) => navigate(`/site/${id}`)}
          />
          <div className="stage-veil" aria-hidden="true" />

          {/* ---- 00 · Hero (reference frame) ---- */}
          <div className="hero-copy chapter" data-chapter="hero" style={{ '--w': 'var(--w-hero)' }}>
            <p className="kicker reveal" style={{ '--at': 0.55 }}>
              <span className="kicker__dot" aria-hidden="true" />
              {HOME.kicker}
            </p>
            <h1 className="display">
              <span className="reveal-line" style={{ '--at': 0.6 }}>
                {HOME.titleLines[0]}
              </span>
              <span className="reveal-line" style={{ '--at': 0.66 }}>
                {HOME.titleLines[1]}
                <em>{HOME.titleAccent}</em>
              </span>
            </h1>
            <p className="lead reveal" style={{ '--at': 0.74 }}>
              {HOME.lead}
            </p>
            <div className="cta-row reveal" style={{ '--at': 0.8 }}>
              <button type="button" className="btn btn--primary" onClick={goChoose}>
                {HOME.ctaPrimary}
                <span aria-hidden="true">↓</span>
              </button>
              <Link to="/map" className="btn btn--ghost" aria-label={HOME.ctaMap}>
                <span className="cta-long">{HOME.ctaMap}</span>
                <span className="cta-short">{HOME.ctaMapShort}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {/* ---- Telemetry HUD (Earth night side) ---- */}
          <aside className="telemetry glass reveal" data-chapter="hero" style={{ '--at': 0.86 }} aria-label="Mars time, computed in your browser">
            <header className="telemetry__head">
              <span className="micro">
                <span className="live-dot" aria-hidden="true" />
                {HOME.telemetryTitle}
              </span>
              <Badge kind="derived" source="mars24" align="start" note={HOME.telemetryNote} />
            </header>
            <dl className="telemetry__grid">
              <div className="telemetry__wide">
                <dt>Season</dt>
                <dd ref={ref('season')}>—</dd>
              </div>
              <div className="telemetry__wide">
                <dt>Message to Earth</dt>
                <dd ref={ref('light')}>—</dd>
              </div>
              <div className="telemetry__wide telemetry__site">
                <dt ref={ref('siteName')}>—</dt>
                <dd>
                  <span ref={ref('ltst')}>—</span> · <span ref={ref('daynight')}>—</span>
                </dd>
              </div>
            </dl>
          </aside>

          {/* ---- 01 · Layers ---- */}
          <div className="chapter chapter--left" data-chapter="layers" style={{ '--w': 'var(--w-layers)' }}>
            <p className="eyebrow">{HOME.story.layers.eyebrow}</p>
            <h2 className="h2">{HOME.story.layers.title}</h2>
            <p className="body">{HOME.story.layers.body}</p>
            <ul className="chips">
              {HOME.story.layers.chips.map((id) => {
                const s = SOURCES[id];
                return (
                  <li key={id} className="chip">
                    <span className="chip__mission">{s.mission}</span>
                    <span className="chip__inst">{s.instrument}</span>
                    <span className="chip__res">{s.resolution.split(' ·')[0]}</span>
                  </li>
                );
              })}
            </ul>
            <Badge kind="nasa" source="mola" note="Each layer in the planner names its mission, instrument and resolution." />
          </div>

          {/* ---- 02 · Cruise ---- */}
          <div className="chapter chapter--left" data-chapter="cruise" style={{ '--w': 'var(--w-cruise)' }}>
            <p className="eyebrow">{HOME.story.cruise.eyebrow}</p>
            <h2 className="h2">{HOME.story.cruise.title}</h2>
            <p className="body">{HOME.story.cruise.body}</p>
            <div className="stats">
              <Stat value={CONSTANTS.radCruise.value} unit={CONSTANTS.radCruise.unit} label="Dose in cruise · RAD" badge={<Badge kind="nasa" source="rad" />} />
              <Stat value={CONSTANTS.radSurface.value} unit={CONSTANTS.radSurface.unit} label="Dose on the surface · RAD" badge={<Badge kind="nasa" source="rad" />} />
              <Stat
                valueRef={ref('lightBig')}
                unit="min"
                label="Light time to Earth, now"
                badge={<Badge kind="derived" source="ephemeris" note={`Range over a synodic cycle: ${CONSTANTS.lightTimeRange.value} min.`} />}
              />
            </div>
          </div>

          {/* ---- 03 · Arrive ---- */}
          <div className="chapter chapter--left" data-chapter="arrive" style={{ '--w': 'var(--w-arrive)' }}>
            <p className="eyebrow">{HOME.story.arrive.eyebrow}</p>
            <h2 className="h2">{HOME.story.arrive.title}</h2>
            <p className="body">{HOME.story.arrive.body}</p>
            <ul className="slope-legend" aria-label="Default slope thresholds">
              <li className="slope slope--go">
                <i aria-hidden="true" />
                <b>&lt; {SLOPE_THRESHOLDS.go}°</b>
                <span>GO</span>
              </li>
              <li className="slope slope--caution">
                <i aria-hidden="true" />
                <b>
                  {SLOPE_THRESHOLDS.go}–{SLOPE_THRESHOLDS.caution}°
                </b>
                <span>CAUTION</span>
              </li>
              <li className="slope slope--nogo">
                <i aria-hidden="true" />
                <b>&gt; {SLOPE_THRESHOLDS.caution}°</b>
                <span>NO-GO</span>
              </li>
            </ul>
            <p className="fine">
              Walk-back radius {EVA_DEFAULTS.walkBackRadiusKm} km · reserve {Math.round(EVA_DEFAULTS.reserveFraction * 100)} % · all
              editable <Badge kind="illustrative" source="assumption" note="Thresholds and suit budgets are engineering assumptions you can change in the planner." />
            </p>
          </div>

          {/* ---- 04 · Choose a site ---- */}
          <div className="chapter chapter--choose" data-chapter="choose" style={{ '--w': 'var(--w-choose)' }}>
            <p className="eyebrow">{HOME.story.choose.eyebrow}</p>
            <h2 className="h2">{HOME.story.choose.title}</h2>
            <p className="body body--sm">
              {HOME.story.choose.body} <Badge kind="nasa" source="sites" />
            </p>
            <ul className="sites" role="list">
              {LANDING_SITES.map((s) => (
                <li key={s.id}>
                  <article
                    className="site-card"
                    data-active={s.id === selectedId ? 'true' : 'false'}
                    onMouseEnter={() => setSelectedId(s.id)}
                  >
                    <button
                      type="button"
                      className="site-card__select"
                      onClick={() => setSelectedId(s.id)}
                      onFocus={() => {
                        setSelectedId(s.id);
                        if (engine.state.progress < 0.86) goChoose();
                      }}
                      aria-pressed={s.id === selectedId}
                    >
                      <span className="site-card__name">{s.name}</span>
                      <span className="site-card__coords">
                        {fmtLat(s.lat)} · {fmtLon(s.lon)}
                      </span>
                    </button>
                    <p className="site-card__science">{s.science}</p>
                    {s.id === selectedId && (
                      <>
                        <p className="site-card__context">{s.context}</p>
                        <p className="site-card__meta">
                          <span>{s.missions.join(' · ')}</span>
                        </p>
                        <button type="button" className="btn btn--primary btn--sm site-card__go" onClick={() => commit(s.id)}>
                          {s.planner ? 'Plan a Marswalk here' : 'Open this site'} <span aria-hidden="true">→</span>
                        </button>
                      </>
                    )}
                  </article>
                </li>
              ))}
            </ul>
            <Link to="/map" className="choose-map">
              Or explore the whole planet on the Mars map <span aria-hidden="true">→</span>
            </Link>
            <div className="lighting" role="group" aria-label="Globe lighting">
              <button type="button" aria-pressed={lighting === 'day'} onClick={() => setLighting('day')}>
                Presentation light
              </button>
              <button type="button" aria-pressed={lighting === 'now'} onClick={() => setLighting('now')}>
                Sun now · Mars24
              </button>
              {lighting === 'now' ? (
                <Badge kind="derived" source="mars24" note="Terminator from the subsolar point at this moment." align="end" />
              ) : (
                <Badge kind="illustrative" source="schematic" note="Lit from the viewer for legibility. Switch to Mars24 for the real terminator." align="end" />
              )}
            </div>
          </div>

          <Link to="/map" className="chapter globe-map btn btn--ghost btn--sm" data-chapter="choose" style={{ '--w': 'var(--w-choose)' }}>
            Open the full Mars map <span aria-hidden="true">→</span>
          </Link>

          <p className="drag-hint micro" aria-hidden="true">
            Drag to rotate · {selected?.name}
          </p>

          {/* ---- Progress rail ---- */}
          <nav className="rail" aria-label="Story chapters">
            {HOME.chapters.map((c, i) => (
              <button key={c.id} type="button" className="rail__item" data-rail data-state="next" onClick={() => engine.scrollToProgress(RAIL[i] + (i === 3 ? 0.02 : 0))}>
                <span className="rail__n">{c.n}</span>
                <span className="rail__label">{c.label}</span>
              </button>
            ))}
          </nav>

          <p className="scroll-cue micro" aria-hidden="true">
            <span className="scroll-cue__line" />
            {HOME.scrollCue}
          </p>

          <p className="schematic-note micro">
            Schematic · not to scale <Badge kind="illustrative" source="schematic" align="end" />
          </p>

          <button type="button" className="skip-intro" onClick={() => engine.skipIntro()}>
            {HOME.skipIntro}
            <span aria-hidden="true"> ⏭</span>
          </button>
        </div>
      </section>

      <section className="features" aria-labelledby="features-title">
        <header className="features__head">
          <p className="eyebrow">{HOME.features.eyebrow}</p>
          <h2 id="features-title" className="h2">
            {HOME.features.title}
          </h2>
          <p className="features__lead">{HOME.features.lead}</p>
        </header>
        <ul className="features__grid">
          {HOME.features.cards.map((c) => (
            <li key={c.art} className="feature">
              <div className="feature__art">
                <FeatureArt kind={c.art} />
              </div>
              <h3 className="feature__title">{c.title}</h3>
              <p className="feature__body">{c.body}</p>
              <Link to={c.link} className="feature__link">
                {c.cta} <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <dl className="facts">
          <div className="fact">
            <dt>Sharpest photo of the ground</dt>
            <dd>
              25 <small>cm per pixel</small>
            </dd>
            <Badge kind="nasa" source="hirise" />
          </div>
          <div className="fact">
            <dt>Radiation on the surface</dt>
            <dd>
              {CONSTANTS.radSurface.value} <small>{CONSTANTS.radSurface.unit}</small>
            </dd>
            <Badge kind="nasa" source="rad" />
          </div>
          <div className="fact">
            <dt>A message to Earth takes, now</dt>
            <dd>
              <span ref={ref('lightBand')}>—</span> <small>min</small>
            </dd>
            <Badge kind="derived" source="ephemeris" align="end" />
          </div>
          <div className="fact">
            <dt>Landing sites to explore</dt>
            <dd>{LANDING_SITES.length}</dd>
            <Badge kind="nasa" source="sites" align="end" />
          </div>
        </dl>
      </section>

      <footer className="home-end">
        <div className="home-end__top">
          <p className="home-end__title">Ready to plan a walk?</p>
          <div className="home-end__actions">
            <Link to="/map" className="btn btn--primary">
              Open the Mars map <span aria-hidden="true">→</span>
            </Link>
            <Link to="/site/jezero" className="btn btn--ghost">
              Plan a walk at Jezero
            </Link>
          </div>
        </div>
        <nav className="home-end__links" aria-label="Footer">
          {FOOTER_NAV.map((n) => (
            <Link key={n.to} to={n.to}>
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="home-end__legal">
          {SITE.name} · {SITE.by} · {SITE.challenge}. {SITE.disclaimer} Mission data courtesy of NASA, JPL-Caltech, USGS
          Astrogeology, ASU and ESA, credited on the <Link to="/sources">Data &amp; sources</Link> page.
        </p>
      </footer>
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
