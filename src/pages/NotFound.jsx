import { Link } from 'react-router'
import Orbits from '../components/Orbits.jsx'

export default function NotFound() {
  return (
    <section style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '120px var(--pad)' }}>
      <div>
        <Orbits className="nf-orbits" />
        <p className="micro" style={{ marginTop: 24 }}>Signal lost</p>
        <h1 style={{ fontSize: 'var(--t-2)', margin: '12px 0 24px' }}>This page drifted <em>off course.</em></h1>
        <Link to="/" className="btn btn-primary">Back to Mars <span className="arrow">→</span></Link>
      </div>
    </section>
  )
}
