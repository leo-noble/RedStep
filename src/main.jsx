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
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'

const page = (load) => async () => ({ Component: (await load()).default })

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'site/:id', lazy: page(() => import('./pages/Site.jsx')) },
      { path: 'guide', lazy: page(() => import('./pages/Guide.jsx')) },
      { path: 'guide/:step', lazy: page(() => import('./pages/Guide.jsx')) },
      { path: 'survival', lazy: page(() => import('./pages/Guide.jsx')) },
      { path: 'habitat', lazy: page(() => import('./pages/Habitat.jsx')) },
      { path: 'sources', lazy: page(() => import('./pages/Sources.jsx')) },
      { path: 'about', lazy: page(() => import('./pages/About.jsx')) },
      { path: 'brief', lazy: page(() => import('./pages/Brief.jsx')) },
      { path: '*', lazy: page(() => import('./pages/NotFound.jsx')) },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
