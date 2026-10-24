// Choose where to look around: real rover panoramas first, then Demo views (from orbit) at the
// science stops. The two groups are labelled so a Demo is never mistaken for rover photos.
import { useEffect, useRef } from 'react'
import { Badge } from './Atoms.jsx'

const R = 3396190
const D = Math.PI / 180
const metres = (a, b) => Math.hypot((a.lon - b.lon) * Math.cos(a.lat * D), a.lat - b.lat) * D * R
const far = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`)

export default function StreetPicker({ panoramas, stops, visited = [], home, canDemo, onPick, onClose }) {
  const dialog = useRef(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  // stops on the current walk first
  const demo = [...stops].sort((a, b) => visited.includes(b.id) - visited.includes(a.id))
  return (
    <dialog ref={dialog} className="sv-pick" aria-labelledby="sv-pick-title" onClose={onClose} onClick={(e) => { if (e.target === dialog.current) onClose() }}>
      <div className="sv-pick-body">
        <div className="sv-pick-head">
          <h2 id="sv-pick-title">Street view</h2>
          <button type="button" className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        <section>
          <h3>Real rover photos <Badge kind="nasa" /></h3>
          {panoramas.length ? (
            <ul>
              {panoramas.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onPick({ pano: p })}>
                    {p.name}
                    <small>{p.rover} · Sol {p.sol} · {metres(p, home) < 25 ? 'at home' : `${far(metres(p, home))} from home`} · {p.pia}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="sv-pick-note">No rover panoramas at this site yet.</p>}
        </section>

        {canDemo && (
          <section>
            <h3>Demo views from orbit · not rover photos</h3>
            <ul>
              {demo.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onPick({ place: s })}>
                    {s.name}
                    <small>Demo 3D view · {visited.includes(s.id) ? 'on your walk · ' : ''}{far(metres(s, home))} from home</small>
                  </button>
                </li>
              ))}
            </ul>
            <p className="sv-pick-note">Demo views drape the MRO CTX photo (and HiRISE where it covers) over the CTX height map. They show the shape of the land, not what a camera on the ground would see.</p>
          </section>
        )}
      </div>
    </dialog>
  )
}
