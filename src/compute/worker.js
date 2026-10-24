// Web Worker: loads the site's height map, derives slopes, and answers route questions,
// so the map never stutters while paths are searched.
import { makeGrid, computeSlope } from './grid.js'
import { createPlanner } from './planner.js'

let g = null
let planner = null

// Fetch with a clear error, reporting download progress as a share of `total` bytes.
async function load(url, onBytes) {
  const r = await fetch(url)
  const name = url.split('/').pop()
  if (!r.ok) throw new Error(`could not download ${name} (HTTP ${r.status})`)
  // a missing file comes back as the app's HTML page (SPA fallback), not as data
  if ((r.headers.get('content-type') || '').includes('text/html')) throw new Error(`${name} is missing from the server`)
  if (!onBytes || !r.body) return r.arrayBuffer()
  const reader = r.body.getReader()
  const parts = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value); got += value.length; onBytes(value.length)
  }
  const out = new Uint8Array(got)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out.buffer
}

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === 'init') {
      const base = `${msg.base}data/${msg.site}/`
      const meta = JSON.parse(new TextDecoder().decode(await load(`${base}meta.json`)))
      // expected bytes: Int16 heights + one byte of ground type per grid cell
      const total = meta.grid.w * meta.grid.h * 3
      let got = 0, last = 0
      const tick = (n) => {
        got += n
        const pct = Math.min(99, Math.round((got / total) * 100))
        if (pct >= last + 2) { last = pct; self.postMessage({ type: 'progress', pct }) }
      }
      const [dm, night] = await Promise.all([load(`${base}elevation.i16`, tick), load(`${base}themis-night.u8`, tick)])
      self.postMessage({ type: 'progress', pct: 100, stage: 'slopes' })
      g = makeGrid(meta.grid, new Int16Array(dm), new Uint8Array(night))
      const slope = computeSlope(g)
      planner = createPlanner(g)
      const copy = slope.slice()
      const elev = g.elev.slice()
      self.postMessage({ type: 'ready', meta, slope: copy, elev, w: g.w, h: g.h, dx: g.dx, dy: g.dy }, [copy.buffer, elev.buffer])
      return
    }
    if (!planner) throw new Error('Planner not ready')
    if (msg.type === 'plan') self.postMessage({ type: 'plan', id: msg.id, ...planner.plan(msg) })
    if (msg.type === 'suggest') self.postMessage({ type: 'suggest', id: msg.id, ...planner.suggest(msg) })
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, init: msg.type === 'init', message: String(err && err.message ? err.message : err) })
  }
}
