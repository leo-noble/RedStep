import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import Orbits from '../components/Orbits.jsx'

// Shown when a page fails to load: usually no connection, or a new version of the site was
// published while this tab was open (its old page files are gone). Reloading fixes both.
export default function RouteError() {
  const err = useRouteError()
  const stale = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String(err?.message || err))
  return (
    <section className="route-error" role="alert">
      <Orbits className="nf-orbits" />
      <p className="micro">{isRouteErrorResponse(err) ? `Error ${err.status}` : 'Lost contact'}</p>
      <h1>{stale ? 'This page needs a reload.' : 'This page could not load.'}</h1>
      <p>{stale ? 'The site was updated, or your connection dropped while the page was loading.' : 'Check your connection and try again.'}</p>
      <div className="route-error-actions">
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
        <Link to="/" className="btn" reloadDocument>Back to Mars</Link>
      </div>
    </section>
  )
}
