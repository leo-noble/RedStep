import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import Badge from './Badge.jsx';
import { PANORAMAS } from '../content/panoramas.js';
import { FOOTER_NAV } from '../content/site.js';
import { HOME, SITE, LANDING_SITES, EVA_DEFAULTS } from './content.js';

const PANO = Object.fromEntries(PANORAMAS.map((p) => [p.id, p]));

/**
 * Everything on the homepage after the rocket story, laid out like a printed report:
 * the map layers as full-screen plates, how a walk is worked out, the two numbers that make
 * Mars different, the rovers' own panoramas, the close and the footer.
 * teleRef(key) hands a node to the page's Mars clock, which writes live text into it.
 */
export default function HomeSections({ teleRef }) {
  const root = useRef(null);
  useEntrances(root);
  useTriptych(root);

  return (
    <div ref={root}>
      {/* ---- The layers: one plate per screen, each on a field of its own darkest tone ---- */}
      <section className="plates" aria-labelledby="plates-title">
        {HOME.plates.map((p, i) => (
          <article key={p.img} className="plate" style={{ '--field': p.field }}>
            {i === 0 ? (
              <h2 id="plates-title" className="plate__title">{p.title}</h2>
            ) : (
              <h3 className="plate__title">{p.title}</h3>
            )}
            <figure className="plate__pic">
              <img src={p.img} alt={p.alt} width="1200" height="1600" loading="lazy" style={{ objectPosition: p.pos, filter: p.grey ? 'grayscale(1) contrast(1.05)' : undefined }} />
            </figure>
            <div className="plate__text">
              <p>{p.text}</p>
              <Badge kind="nasa" source={p.source} />
            </div>
            <Link to={p.link} className="plate__link">
              {p.cta} <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </section>

      {/* ---- How a walk is worked out: many readings pulled into one answer ---- */}
      <section className="many" aria-labelledby="many-title">
        <div className="many__head" data-in>
          <h2 id="many-title">{HOME.many.title}</h2>
          <p>{HOME.many.body}</p>
        </div>
        <ManyIntoOne />
        <ol className="many__steps">
          {HOME.many.steps.map((s) => (
            <li key={s.name} data-in>
              <h3>{s.name}</h3>
              <p>{s.text}</p>
              <Link to={s.link} className="many__shot">
                <img src={s.img} alt={s.alt} width="1600" height="900" loading="lazy" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Two numbers: how far help is, and how much air stays in reserve ---- */}
      <section className="figures" aria-labelledby="figures-title">
        <h2 id="figures-title" data-in>{HOME.figures.title}</h2>
        <div className="figures__mosaic">
          <figure className="figures__pic">
            <img src="/data/panoramas/butler-3k.webp" alt={PANO.butler.alt} width="3000" height="796" loading="lazy" />
          </figure>
          <div className="figures__tile figures__tile--a" data-in>
            <p className="figures__n">
              <span ref={teleRef('lightBig')}>—</span> min
            </p>
            <p>{HOME.figures.light}</p>
            <Badge kind="derived" source="ephemeris" note="Computed in your browser from the orbits of Earth and Mars." />
          </div>
          <div className="figures__tile figures__tile--b" data-in>
            <p className="figures__n">{Math.round(EVA_DEFAULTS.reserveFraction * 100)} %</p>
            <p>{HOME.figures.reserve}</p>
            <Badge kind="illustrative" source="assumption" />
          </div>
        </div>
      </section>

      {/* ---- The rovers' own views: three panoramas rise as the page scrolls ---- */}
      <section className="triptych" aria-labelledby="triptych-title">
        <div className="triptych__stage">
          <div className="triptych__head" data-in>
            <h2 id="triptych-title">{HOME.triptych.title}</h2>
            <p>
              {HOME.triptych.body}{' '}
              <Link to="/site/jezero">{HOME.triptych.cta}</Link>
            </p>
          </div>
          <div className="triptych__pics">
            <figure className="triptych__pic triptych__pic--side">
              <img src="/data/panoramas/vanzyl-3k.webp" alt={PANO.vanzyl.alt} width="3000" height="666" loading="lazy" />
            </figure>
            <figure className="triptych__pic triptych__pic--centre">
              <img src="/data/panoramas/mercou-3k.webp" alt={PANO.mercou.alt} width="3000" height="812" loading="lazy" />
            </figure>
            <figure className="triptych__pic triptych__pic--side triptych__pic--right">
              <img src="/data/panoramas/butler-3k.webp" alt={PANO.butler.alt} width="3000" height="796" loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      {/* ---- The close: the name's idea again, on the inverted field ---- */}
      <section className="close" aria-labelledby="close-title">
        <h2 id="close-title" data-in>{HOME.close.title}</h2>
        <div className="close__foot" data-in>
          <p>{HOME.close.body}</p>
          <Link to="/map" className="btn btn--primary">
            {HOME.close.cta} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="home-end">
        <p className="home-end__name" aria-hidden="true">{SITE.name}</p>
        <div className="home-end__row">
          <div>
            <h2 className="home-end__h">Landing sites</h2>
            <ul className="home-end__places">
              {LANDING_SITES.map((s) => (
                <li key={s.id}>
                  <Link to={`/site/${s.id}`}>{s.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <nav className="home-end__links" aria-label="Footer">
            {FOOTER_NAV.map((n) => (
              <Link key={n.to} to={n.to}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="home-end__legal">
          <p>
            {SITE.name} · {SITE.by} · {SITE.challenge}. {SITE.disclaimer} {HOME.credits}{' '}
            <Link to="/sources">Data &amp; sources</Link>.
          </p>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */

/** Deterministic scatter so the diagram is the same on every visit. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** One small square per reading: scattered (the data), pulled into a ribbon (the checks),
 *  set out in rows (the answer). Drawn wide on desktop and tall on a phone. */
function squares(vertical) {
  const r = rng(7);
  const out = [];
  const W = 1200;
  const H = 266;
  const sz = 12;
  // scattered, in two pale tones
  for (let i = 0; i < 44; i++) out.push({ a: 20 + r() * 340, b: 14 + r() * (H - 40), t: r() > 0.5 ? 'p1' : 'p2' });
  // the ribbon, three squares high
  for (let c = 0; c < 26; c++) for (let k = 0; k < 3; k++) out.push({ a: 404 + c * 15, b: H / 2 - 22 + k * 15, t: c % 4 === 0 ? 'p1' : 'p2' });
  // ordered rows in the accent
  for (let c = 0; c < 8; c++) for (let k = 0; k < 5; k++) out.push({ a: 840 + c * 44, b: 34 + k * 46, t: 'acc' });
  return { W, H, sz, list: vertical ? out.map((q) => ({ ...q, a: q.b * (300 / H), b: q.a * (400 / W) * 1.0 })) : out };
}

function ManyIntoOne() {
  const wide = squares(false);
  const tall = squares(true);
  return (
    <div className="many__fig" aria-hidden="true">
      <svg className="many__svg many__svg--wide" viewBox={`0 0 ${wide.W} ${wide.H}`}>
        {wide.list.map((q, i) => (
          <rect key={i} className={`sq sq--${q.t}`} x={q.a} y={q.b} width={wide.sz} height={wide.sz} style={{ '--i': i }} />
        ))}
      </svg>
      <svg className="many__svg many__svg--tall" viewBox="0 0 300 400">
        {tall.list.map((q, i) => (
          <rect key={i} className={`sq sq--${q.t}`} x={q.a} y={q.b} width="5" height="5" style={{ '--i': i }} />
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */

/** Parts of each section rise in once, in order, as the section arrives. */
function useEntrances(root) {
  useEffect(() => {
    const el = root.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    el.classList.add('js-in');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    el.querySelectorAll('[data-in], .plate, .many__fig, .figures__pic').forEach((n) => io.observe(n));
    // never leave content hidden if the observer does not fire (background tabs, odd browsers)
    const t = setTimeout(() => el.querySelectorAll('[data-in], .plate, .many__fig, .figures__pic').forEach((n) => n.classList.add('is-in')), 4000);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, [root]);
}

/** The triptych's pictures rise with the scroll (one CSS variable on the section, 0 → 1). */
function useTriptych(root) {
  useEffect(() => {
    const sec = root.current?.querySelector('.triptych');
    if (!sec) return undefined;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = sec.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
      sec.style.setProperty('--tp', p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [root]);
}
