import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router'
import { FOOTER_NAV, NAV, SITE } from '../content/site.js'
import { useInstall, promptInstall } from '../lib/install.js'
import './nav.css'

export default function Nav({ overlay, onEmergency }) {
  const [open, setOpen] = useState(false)
  const [iosTip, setIosTip] = useState(false)
  const install = useInstall()
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  const isOn = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to.split('/').slice(0, 2).join('/')))

  return (
    <header className={`nav ${overlay ? 'nav-overlay' : ''} ${open ? 'nav-open' : ''}`} style={{ '--items': FOOTER_NAV.length + (install ? 1 : 0) }}>
      <Link to="/" className="nav-brand" aria-label={`${SITE.name}, home`}>
        <img src="/icons/mark.svg" alt="" width="26" height="26" className="nav-mark" />
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
      <div id="nav-sheet" className="nav-sheet" inert={!open} aria-hidden={!open}>
        {FOOTER_NAV.map((n, i) => <NavLink key={n.to} to={n.to} end style={{ '--i': i }}>{n.label}</NavLink>)}
        {install && (
          <button type="button" className="nav-install" style={{ '--i': FOOTER_NAV.length }} onClick={() => (install === 'prompt' ? promptInstall() : setIosTip((t) => !t))}>
            <img src="/icons/icon-192.png" alt="" width="28" height="28" />
            <span>{iosTip ? 'Tap Share, then “Add to Home Screen”' : 'Install the app'}</span>
          </button>
        )}
      </div>
    </header>
  )
}
