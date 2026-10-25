import { lazy, Suspense } from 'react'
import './mappage.css'

// The whole-planet Mars map (MapLibre). The heaviest code in the app, so it loads on its own;
// the cinematic homepage (src/home) prefetches it once the browser is idle.
const Explorer = lazy(() => import('../components/Explorer.jsx'))

export default function MapPage() {
  return (
    <div className="map-page">
      <Suspense fallback={<p className="map-loading" role="status"><i className="spinner" aria-hidden="true" />Loading the Mars map…</p>}>
        <Explorer visible />
      </Suspense>
    </div>
  )
}
