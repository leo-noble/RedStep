import { Badge, Eyebrow } from '../components/Atoms.jsx'
import { BADGES } from '../content/site.js'
import { DATA, FACT_SOURCES } from '../content/sources.js'
import { WALK } from '../content/assumptions.js'
import { BASE } from '../content/habitat.js'
import './page.css'

const groups = [...new Set(DATA.map((d) => d.group))]

export default function Sources() {
  return (
    <div className="page">
      <header className="page-head">
        <Eyebrow>Data &amp; sources</Eyebrow>
        <h1>Where every<br /><span className="serif">number comes from.</span></h1>
        <p className="page-lead">Nothing here is live telemetry. Maps and measurements come from NASA missions and are bundled with the app, so it works offline. We label every number with one of three tags:</p>
        <ul className="badge-key">
          {Object.entries(BADGES).map(([k, b]) => <li key={k}><Badge kind={k} /> <span>{b.long}</span></li>)}
        </ul>
      </header>

      {groups.map((g) => (
        <section key={g} className="src-group">
          <h2 className="micro">{g}</h2>
          <div className="src-table" role="table" aria-label={`${g} data`}>
            <div className="src-row src-th" role="row">
              <span role="columnheader">What it shows</span>
              <span role="columnheader">Mission · instrument</span>
              <span role="columnheader">Detail</span>
              <span role="columnheader">Product · licence</span>
            </div>
            {DATA.filter((d) => d.group === g).map((d) => (
              <div key={d.id} className="src-row" role="row">
                <span role="cell"><b>{d.name}</b><small>{d.plain}</small></span>
                <span role="cell">{d.mission}<small>{d.instrument}</small></span>
                <span role="cell" className="mono">{d.resolution}</span>
                <span role="cell"><a href={d.url} target="_blank" rel="noreferrer">{d.product} ↗</a><small>{d.by} · {d.licence}</small></span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="src-group">
        <h2 className="micro">Facts and methods</h2>
        <ul className="src-facts">
          {Object.entries(FACT_SOURCES).map(([k, f]) => <li key={k}><a href={f.url} target="_blank" rel="noreferrer">{f.title} ↗</a></li>)}
        </ul>
      </section>

      <section className="src-group">
        <h2 className="micro">What we calculate ourselves <Badge kind="derived" /></h2>
        <ul className="src-methods">
          <li><b>Steepness</b> from the CTX height map, using Horn&rsquo;s 3&times;3 method on a 40 m grid (the 20 m map averaged 2&times;2).</li>
          <li><b>Safe paths</b> by searching the grid (A* and Dijkstra, 8 directions, no corner cutting). Ground above your &ldquo;too steep&rdquo; limit is blocked; amber ground and loose ground (dark in THEMIS night infrared) cost more.</li>
          <li><b>Walking time</b> from Tobler&rsquo;s hiking rule, scaled so flat ground matches your walking speed.</li>
          <li><b>Suit air</b>: hours of air at normal effort, used faster when climbing. The turn-back point is the last place where air used plus air to walk home the same way still leaves your reserve.</li>
          <li><b>Sun height</b> with NASA GISS&rsquo;s Mars24 algorithm, checked against both worked examples on the Mars24 page.</li>
          <li><b>Earth delay</b> from the planets&rsquo; positions (Mars24 + Meeus), checked against the January 2025 close approach (0.642 AU).</li>
          <li><b>Radiation</b>: hours outside times Curiosity RAD&rsquo;s 0.64 mSv per day.</li>
          <li><b>Map projection</b>: the map draws in Web Mercator; all distances use Mars&rsquo;s radius. 3D heights are scaled so 1&times; is true to scale, then shown at 2&times;.</li>
        </ul>
      </section>

      <section className="src-group">
        <h2 className="micro">Assumptions you can change <Badge kind="illustrative" /></h2>
        <div className="src-assume">
          {[...Object.values(WALK), ...Object.values(BASE).filter((b) => b.badge === 'illustrative')].map((a) => (
            <div key={a.label}><b>{a.label}</b><span className="mono">{a.value} {a.unit}</span>{a.note && <small>{a.note}</small>}</div>
          ))}
        </div>
      </section>

      <section className="src-group">
        <h2 className="micro">Known limits</h2>
        <ul className="src-methods">
          <li>The height map is 40 m per cell. Boulders, small ledges and loose sand are not visible at that scale. A real crew would use HiRISE height maps (1 m) and look at the ground.</li>
          <li>Suit numbers are planning values, not the specification of any real Mars suit.</li>
          <li>Weather is not live. Perseverance&rsquo;s MEDA station measures it daily, but this demo does not download it.</li>
          <li>Radiation uses Curiosity&rsquo;s Gale Crater average; solar storms can raise it sharply.</li>
          <li>Lava tubes on Mars are unconfirmed. Mars soil needs perchlorate removal before it can grow food.</li>
        </ul>
      </section>
    </div>
  )
}
