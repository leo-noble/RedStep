import { Link } from 'react-router'
import { Eyebrow, Badge, Slider } from '../components/Atoms.jsx'
import { FarmCalc, OxygenCalc, ShelterCalc, useBase, useBaseTotals } from '../components/guide/Base.jsx'
import { BASE } from '../content/habitat.js'
import './page.css'

export default function Habitat() {
  const [b, set] = useBase()
  const t = useBaseTotals(b)
  return (
    <div className="page">
      <header className="page-head">
        <Eyebrow>Base calculator</Eyebrow>
        <h1>What does a crew<br /><span className="serif">need to live?</span></h1>
        <p className="page-lead">Change the crew size and every assumption. Air, water, food and shelter update together. Numbers marked <Badge kind="nasa" /> come from missions; numbers marked <Badge kind="illustrative" /> are planning guesses you can change.</p>
      </header>

      <section className="hab-summary glass">
        <div className="hab-crew">
          <Slider id="hab-crew" label={BASE.crew.label} value={b.crew} min={BASE.crew.min} max={BASE.crew.max} step={1} unit="people" onChange={set('crew')} />
        </div>
        <dl className="hab-totals">
          <div><dt className="micro">Oxygen</dt><dd>{t.o2.toFixed(1)}<small>kg/sol</small></dd></div>
          <div><dt className="micro">New water</dt><dd>{t.water.toFixed(0)}<small>L/sol</small></dd></div>
          <div><dt className="micro">Food energy</dt><dd>{(t.kcal / 1000).toFixed(1)}<small>Mcal/day</small></dd></div>
          <div><dt className="micro">Grown on site</dt><dd className={t.farmShare < 1 ? 'v-caution' : 'v-go'}>{Math.round(t.farmShare * 100)}<small>%</small></dd></div>
        </dl>
      </section>

      <section className="hab-block">
        <h2><span className="mono">01</span> Air</h2>
        <OxygenCalc b={b} set={set} />
      </section>
      <section className="hab-block">
        <h2><span className="mono">02</span> Water and food</h2>
        <FarmCalc b={b} set={set} />
      </section>
      <section className="hab-block">
        <h2><span className="mono">03</span> Shelter</h2>
        <ShelterCalc b={b} set={set} />
      </section>

      <section className="page-cta">
        <p>Learn why each of these matters, step by step.</p>
        <Link to="/guide/air" className="btn btn-primary">Open the survival guide <span className="arrow">→</span></Link>
      </section>
    </div>
  )
}
