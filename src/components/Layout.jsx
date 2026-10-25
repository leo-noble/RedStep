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
  // Full-screen views: no footer, no ambient background.
  const immersive = pathname === '/' || pathname === '/map' || pathname.startsWith('/site/') || pathname === '/brief'

  useEffect(() => { if (!pathname.startsWith('/guide')) window.scrollTo(0, 0) }, [pathname])

  return (
    <EmergencyCtx.Provider value={ctx}>
      <a className="skip" href="#main">Skip to content</a>
      {pathname !== '/brief' && <Nav overlay={immersive} onEmergency={() => open()} />}
      <main id="main" tabIndex={-1} className={immersive ? '' : 'has-ambient'}>
        {!immersive && <Ambient />}
        <Outlet />
      </main>
      {!immersive && <Footer />}
      <EmergencyDrawer state={emergency} onClose={close} />
    </EmergencyCtx.Provider>
  )
}
