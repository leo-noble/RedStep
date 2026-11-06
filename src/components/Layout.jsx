import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import Nav from './Nav.jsx'
import Footer from './Footer.jsx'
import EmergencyDrawer from './EmergencyDrawer.jsx'
import Ambient from './Ambient.jsx'

const EmergencyCtx = createContext({ open: () => {} })
export const useEmergency = () => useContext(EmergencyCtx)

export default function Layout() {
  const { pathname } = useLocation()
  const [emergency, setEmergency] = useState(null) // null = closed, otherwise { focus }
  const open = useCallback((focus = null) => setEmergency({ focus }), [])
  const close = useCallback(() => setEmergency(null), [])
  const ctx = useMemo(() => ({ open }), [open])
  const home = pathname === '/'
  // Full-screen views: no footer, no ambient background. Home ends in its own short credits.
  const immersive = home || pathname === '/map' || pathname.startsWith('/site/') || pathname === '/brief' || pathname === '/cuff'

  useEffect(() => { if (!pathname.startsWith('/guide')) window.scrollTo(0, 0) }, [pathname])

  // Content pages: blocks rise in as they scroll into view (once each).
  useEffect(() => {
    if (immersive || typeof IntersectionObserver === 'undefined') return undefined
    let io
    const id = requestAnimationFrame(() => {
      const els = document.querySelectorAll('#main .page > *, #main .page section > *, #main .g-main > *')
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target) }
      }, { rootMargin: '0px 0px -8% 0px' })
      // only blocks below the fold animate; what is already on screen just shows
      els.forEach((el, i) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
        el.classList.add('rv'); el.style.setProperty('--rv-i', String(i % 4)); io.observe(el)
      })
    })
    // never leave content hidden if the observer is slow or paused
    const safety = setTimeout(() => document.querySelectorAll('#main .rv').forEach((el) => el.classList.add('rv-in')), 3000)
    return () => { cancelAnimationFrame(id); clearTimeout(safety); io?.disconnect() }
  }, [pathname, immersive])

  return (
    <EmergencyCtx.Provider value={ctx}>
      <a className="skip" href="#main">Skip to content</a>
      {pathname !== '/brief' && pathname !== '/cuff' && <Nav overlay={immersive} onEmergency={() => open()} />}
      <main id="main" tabIndex={-1} className={immersive ? '' : 'has-ambient'}>
        {!immersive && <Ambient />}
        <Outlet />
      </main>
      {!immersive && <Footer />}
      <EmergencyDrawer state={emergency} onClose={close} />
    </EmergencyCtx.Provider>
  )
}
