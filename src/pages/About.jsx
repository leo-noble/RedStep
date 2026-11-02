import { Link } from 'react-router'
import Orbits from '../components/Orbits.jsx'
import PictureBand from '../components/PictureBand.jsx'
import { SITE } from '../content/site.js'
import './page.css'

const MAP = [
  ['Layered, integrated view', 'Eleven map layers from six spacecraft, stacked on one map with opacity sliders, each labelled with its mission, instrument and detail level.'],
  ['Data from many NASA missions', 'MRO (HiRISE, CTX), Mars Global Surveyor (MOLA, TES), Mars Odyssey (THEMIS), Viking, Curiosity (RAD), Perseverance (traverse, samples). Mars Express HRSC heights are blended into one relief map.'],
  ['Plan a successful Marswalk', 'Steepness, suit air with a turn-back point, a walk-back circle, real sun height (Mars24), radiation dose and Earth delay give a GO, CAUTION or NO-GO with reasons.'],
  ['New science along the way', 'Nine science stops at real Perseverance sample sites. Each says what it is, why it matters and which mission data backs it. The planner balances safety and science openly.'],
]

// Only real entries: skip blanks and unfilled template text.
const team = SITE.team.filter((m) => m && m.name && !/fill in/i.test(m.name))

export default function About() {
  return (
    <div className="page">
      <header className="page-head">
        <h1>A survival guide you can walk</h1>
        <p className="page-lead">{SITE.name} is our answer to NASA Space Apps 2026 &ldquo;Interplanetary Survival Guide: Martian Map&rdquo;: a layered Mars map that helps a human explorer plan a safe walk and do new science on the way.</p>
      </header>

      <PictureBand ids={['vanzyl', 'hirise', 'planner', 'mercou']} />

      <section className="about-grid">
        <div>
          <h2 className="micro">The problem</h2>
          <p>The first people on Mars will walk outside in pressure suits, far from help, with Earth minutes away by radio. Every walk is a trade: more science means more distance, more air and more risk. The data to plan that trade exists, but it is spread over many missions, formats and websites.</p>
        </div>
        <div>
          <h2 className="micro">Our solution</h2>
          <p>One map that pulls the data together, and a planner that turns it into a plain answer. Press one button to get a safe route that visits real sample sites, or draw your own and see it rejected, with the reason, the moment it crosses a cliff or runs out of air.</p>
        </div>
      </section>

      <section className="about-map">
        <h2 className="micro">How it answers the challenge</h2>
        <ol>
          {MAP.map(([t, d]) => <li key={t}><b>{t}</b><p>{d}</p></li>)}
        </ol>
      </section>

      <section className="about-grid">
        <div>
          <h2 className="micro">What is real, and what is not</h2>
          <p>Maps, heights, the rover path, sample sites and dose rates are NASA data. Steepness, paths, sun height and Earth delay are calculated in your browser from that data, with the method on the <Link to="/sources">sources page</Link>. Suit size, walking speed and safety margins are planning guesses, marked Illustrative, and you can change them. The advisor is a fixed set of rules, not an AI.</p>
        </div>
        <div>
          <h2 className="micro">Next steps</h2>
          <ul className="about-list">
            <li>HiRISE 1 m height maps for metre-scale hazards.</li>
            <li>Live weather from Perseverance&rsquo;s MEDA when NASA posts it.</li>
            <li>More sites: Gale Crater and the ice-rich landing zones.</li>
            <li>Rover-assisted walks and two-person buddy planning.</li>
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
