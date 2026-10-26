import { isRouteErrorResponse, Link, useLocation, useRouteError } from 'react-router'
import Orbits from '../components/Orbits.jsx'

// Shown when a page fails. Three cases, each with its own advice:
// - a new version of the site was published while this tab was open (its old page files are
//   gone), or the connection dropped mid-load: reloading fixes it;
// - no connection at all;
// - a bug in the page itself: say so plainly, and offer the page without the link's settings,
//   in case a hand-edited link caused it.
export default function RouteError() {
  const err = useRouteError()
  const { pathname, search } = useLocation()
  const stale = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String(err?.message || err))
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const title = stale ? 'This page needs a reload.' : offline ? 'This page could not load.' : 'Something went wrong on this page.'
  const text = stale
    ? 'The site was updated, or your connection dropped while the page was loading.'
    : offline
      ? 'You seem to be offline. Check your connection and try again.'
      : 'It is a problem with the page, not your connection. Reload, or start this page fresh.'
  return (
    <section className="route-error" role="alert">
      <Orbits className="nf-orbits" />
      <p className="micro">{isRouteErrorResponse(err) ? `Error ${err.status}` : stale || offline ? 'Lost contact' : 'Fault'}</p>
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="route-error-actions">
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
        {search && !stale && !offline && <Link to={pathname} className="btn" reloadDocument>Start this page fresh</Link>}
        <Link to="/" className="btn" reloadDocument>Back to Mars</Link>
      </div>
    </section>
  )
}
