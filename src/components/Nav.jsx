import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router'
import { FOOTER_NAV, NAV, SITE } from '../content/site.js'
import './nav.css'

export default function Nav({ overlay, onEmergency }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  const isOn = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to.split('/').slice(0, 2).join('/')))

  return (
    <header className={`nav ${overlay ? 'nav-overlay' : ''} ${open ? 'nav-open' : ''}`}>
      <Link to="/" className="nav-brand" aria-label={`${SITE.name}, home`}>
        <svg viewBox="0 0 28 28" aria-hidden="true" className="nav-mark">
          <ellipse cx="14" cy="14" rx="12.5" ry="4.6" fill="none" stroke="currentColor" strokeOpacity=".5" transform="rotate(-20 14 14)" />
          <circle cx="14" cy="14" r="5.4" fill="var(--rust)" />
        </svg>
        <span className="nav-name">{SITE.name}</span>
      </Link>
      <nav className="nav-links" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={isOn(n.to) ? 'on' : ''} end={n.to === '/'}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="nav-end">
        <button type="button" className="nav-sos" onClick={onEmergency}>
          <span className="nav-sos-dot" aria-hidden="true" />
          <span>Emergency</span>
        </button>
        <button type="button" className="nav-burger" aria-expanded={open} aria-controls="nav-sheet" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">Menu</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
      <div id="nav-sheet" className="nav-sheet" hidden={!open}>
        {FOOTER_NAV.map((n) => <NavLink key={n.to} to={n.to} end>{n.label}</NavLink>)}
      </div>
    </header>
  )
}
