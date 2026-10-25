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
import '@fontsource/instrument-serif/400-italic.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/touch.css'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import RouteError from './pages/RouteError.jsx'

// Shown inside the layout while a page's code downloads on the first visit, so the nav appears
// straight away instead of a blank screen.
const PageLoading = () => <div className="page-loading" aria-busy="true" />
const page = (load) => ({ lazy: async () => ({ Component: (await load()).default }), HydrateFallback: PageLoading })

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
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
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
