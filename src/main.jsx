// Dev-only test aid: ?raf=timer drives animation frames from a timer, for screenshots taken
// while the browser tab is in the background (where real frames are paused).
if (import.meta.env.DEV && new URLSearchParams(location.search).get('raf') === 'timer') {
  sessionStorage.setItem('raf', 'timer')
}
if (import.meta.env.DEV && sessionStorage.getItem('raf') === 'timer') {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)
  window.cancelAnimationFrame = (id) => clearTimeout(id)
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/touch.css'
import './styles/platform.css'
import { platform } from './lib/platform.js'
import Layout from './components/Layout.jsx'
import RouteError from './pages/RouteError.jsx'

// Shown inside the layout while a page's code downloads on the first visit, so the nav appears
// straight away instead of a blank screen.
const PageLoading = () => <div className="page-loading" aria-busy="true" />
const page = (load) => ({ lazy: async () => ({ Component: (await load()).default }), HydrateFallback: PageLoading })

document.documentElement.dataset.platform = platform

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, ...page(() => import('./home/HomePage.jsx')) },
      { path: 'map', ...page(() => import('./pages/MapPage.jsx')) },
      { path: 'site/:id', ...page(() => import('./pages/Site.jsx')) },
      { path: 'guide', ...page(() => import('./pages/Guide.jsx')) },
      { path: 'guide/:step', ...page(() => import('./pages/Guide.jsx')) },
      { path: 'survival', ...page(() => import('./pages/Guide.jsx')) },
      { path: 'habitat', ...page(() => import('./pages/Habitat.jsx')) },
      { path: 'sources', ...page(() => import('./pages/Sources.jsx')) },
      { path: 'about', ...page(() => import('./pages/About.jsx')) },
      { path: 'brief', ...page(() => import('./pages/Brief.jsx')) },
      { path: '*', ...page(() => import('./pages/NotFound.jsx')) },
    ],
  },
])

// Offline support: the service worker (dist/sw.js, built by vite.config.js) keeps the app and
// the Jezero data after the first visit. Production only, so development always sees fresh files.
// It starts once the page has settled, so its download never competes with the first view,
// and not at all on data saver or a very slow connection.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const conn = navigator.connection
  const thrifty = conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')
  if (!thrifty) {
    window.addEventListener('load', () => {
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1))
      setTimeout(() => idle(() => navigator.serviceWorker.register('/sw.js').catch(() => {})), 6000)
    })
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
