import { Link } from 'react-router'
import Orbits from '../components/Orbits.jsx'
import { SITE } from '../content/site.js'
import './page.css'

// The 2026 challenge statement, point by point, and where each is answered in the app.
const MAP = [
  ['A layered, integrated view from many NASA missions', 'Eleven map layers from six spacecraft (MRO, MGS, Mars Odyssey, Viking, Curiosity, Perseverance) on one map, each labelled with mission, instrument and detail.', '/map', 'Mars map'],
  ['A map an astronaut uses during the surface mission', 'Helmet view: a suit display over the 3D route (heading, air, sun, next stop, turn-back). Cuff view: a tablet checklist that works offline.', '/site/gale', 'Helmet view'],
  ['Start from the science goal, then pick the place', 'Gale Crater is planned around Curiosity\u2019s 2025 boxwork on Mount Sharp, with stops at its real drill sites. Jezero is planned around Perseverance\u2019s samples.', '/site/gale', 'Gale planner'],
  ['At least three data types', 'Optical (HiRISE, CTX, Viking), thermal (THEMIS day and night), topographic (MOLA, HRSC, CTX and HiRISE height maps) and radiation (Curiosity RAD).', '/sources', 'Sources'],
  ['Safety first: radiation and space weather', 'Radiation dose for every walk from Curiosity RAD, and a live space-weather card (NASA DONKI, NOAA GOES) that says postpone during a particle storm.', '/site/jezero', 'Planner'],
  ['Suit mobility, gear and a route around big rocks', 'Slope limits, a carried-gear setting that raises air use, and a rocky-ground layer from HiRISE photos that the route finder avoids.', '/site/jezero', 'Planner'],
  ['Crews in pairs, rovers carrying crew', 'Buddy walks (the suit that breathes hardest sets the turn-back; never split up) and rover drop-off with the walk-back circle on the rover.', '/site/gale', 'Planner'],
  ['Point-of-view images of what to expect', 'Real rover panoramas in Street view, and a 3D ground view built from orbit where no rover stood.', '/site/jezero', 'Street view'],
  ['Past, predicted or no time frame', 'Mars24 sun height for any date from 2026 to 2035, and the best time to leave for the sun to stay up.', '/site/jezero', 'Planner'],
]

// Only real entries: skip blanks and unfilled template text.
const team = SITE.team.filter((m) => m && m.name && !/fill in/i.test(m.name))

export default function About() {
  return (
    <div className="page">
      <header className="page-head">
        <h1>A survival guide you can <em>walk.</em></h1>
        <p className="page-lead">{SITE.name} is our answer to NASA Space Apps 2026 &ldquo;Interplanetary Survival Guide: Martian Map&rdquo;: a layered Mars map that helps a human explorer plan a safe walk and do new science on the way.</p>
      </header>

      <section className="about-grid">
        <div>
          <h2 className="micro">The problem</h2>
          <p>The first people on Mars will walk outside in pressure suits, far from help, with Earth minutes away by radio. Every walk is a trade: more science means more distance, more air and more risk. The data to plan that trade exists, but it is spread over many missions, formats and websites.</p>
        </div>
        <div>
          <h2 className="micro">Our solution</h2>
          <p>One map that pulls the data together, and a planner that turns it into a plain answer for the first crews and the people who plan their walks. Press one button to get a safe route past real sample sites, or draw your own and see it rejected, with the reason, the moment it crosses a cliff or runs out of air. Then walk it in the helmet view and take the checklist on your wrist.</p>
        </div>
      </section>

      <section className="about-map">
        <h2 className="micro">How it answers the challenge</h2>
        <table className="about-table">
          <thead><tr><th scope="col">The challenge asks for</th><th scope="col">Where Redstep answers it</th></tr></thead>
          <tbody>
            {MAP.map(([t, d, to, label]) => (
              <tr key={t}>
                <th scope="row">{t}</th>
                <td>{d} <Link to={to}>{label} <span aria-hidden="true">→</span></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="about-grid">
        <div>
          <h2 className="micro">What is real, and what is not</h2>
          <p>Maps, heights, the rover path, sample sites and dose rates are NASA data. Steepness, paths, sun height and Earth delay are calculated in your browser from that data, with the method on the <Link to="/sources">sources page</Link>. Suit size, walking speed and safety margins are planning guesses, marked Illustrative, and you can change them. The advisor is a fixed set of rules, not an AI.</p>
        </div>
        <div>
          <h2 className="micro">Next steps</h2>
          <ul className="about-list">
            <li>A spectral layer: CRISM mineral maps, once the challenge&rsquo;s data resources are out.</li>
            <li>Metre-scale hazards: the Gale height map is 1 m, and we plan on 40 m cells today.</li>
            <li>Live weather from Perseverance&rsquo;s MEDA when NASA posts it.</li>
            <li>More sites: the ice-rich candidate landing zones.</li>
          </ul>
        </div>
      </section>

      <section className="about-team">
        <Orbits className="about-orbits" label />
        <div>
          {team.length > 0 && (
            <>
              <h2 className="micro">Team</h2>
              <ul className="about-members">
                {team.map((m) => <li key={m.name}><b>{m.name}</b>{m.role && <span>{m.role}</span>}</li>)}
              </ul>
            </>
          )}
          <p className="about-legal">{SITE.disclaimer}</p>
          <div className="about-cta">
            <Link to="/site/jezero" className="btn btn-primary">Plan a walk <span className="arrow">→</span></Link>
            <Link to="/guide" className="btn">Survival guide</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
