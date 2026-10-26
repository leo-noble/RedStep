import { useId } from 'react';
import { BADGES, SOURCES } from './content.js';

/**
 * Honesty badge: NASA DATA · DERIVED · ILLUSTRATIVE, with a source tooltip.
 * Shape encodes the kind as well as colour (solid / ring / dashed) for colour-blind users.
 */
export default function Badge({ kind = 'nasa', source, note, align = 'start' }) {
  const id = useId();
  const b = BADGES[kind];
  const s = source ? SOURCES[source] : null;
  return (
    <span className={`badge badge--${kind}`} data-align={align}>
      <button type="button" className="badge__chip" aria-describedby={id}>
        <span className="badge__mark" aria-hidden="true" />
        {b.label}
      </button>
      <span role="tooltip" id={id} className="badge__tip">
        <span className="badge__tip-kind">{b.label}</span>
        <span className="badge__tip-long">{b.long}</span>
        {s && (
          <>
            <span className="badge__tip-src">
              {s.mission} · {s.instrument}
              {s.product ? ` — ${s.product}` : ''}
            </span>
            {s.resolution && <span className="badge__tip-meta">Resolution: {s.resolution}</span>}
            {s.citation && <span className="badge__tip-meta">{s.citation}</span>}
          </>
        )}
        {note && <span className="badge__tip-note">{note}</span>}
      </span>
    </span>
  );
}
