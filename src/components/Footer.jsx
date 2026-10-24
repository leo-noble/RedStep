import { Link } from 'react-router'
import { FOOTER_NAV, SITE } from '../content/site.js'
import Orbits from './Orbits.jsx'
import { ambientMotion, useAmbientMotion, useReducedMotion } from '../lib/hooks.js'
import './footer.css'

export default function Footer() {
  const moving = useAmbientMotion()
  const reduced = useReducedMotion()
  return (
    <footer className="footer">
      <Orbits className="footer-orbits" />
      <div className="footer-top">
        <div>
          <p className="footer-name">{SITE.name}</p>
          <p className="micro">{SITE.by} · {SITE.challenge}</p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          {FOOTER_NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}</Link>)}
        </nav>
      </div>
      <hr className="rule" />
      <p className="footer-motion">
        {reduced
          ? 'Background motion is off because your device asks for reduced motion.'
          : <button type="button" className="footer-motion-btn" aria-pressed={moving} onClick={() => ambientMotion.set(!moving)}>Background motion: {moving ? 'on' : 'off'}</button>}
      </p>
      <p className="footer-legal">{SITE.disclaimer} Mission data courtesy of NASA, JPL-Caltech, USGS Astrogeology, ASU and ESA, credited on the <Link to="/sources">Data &amp; sources</Link> page.</p>
    </footer>
  )
}
