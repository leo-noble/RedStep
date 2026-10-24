// Web Worker: loads the site's height map, derives slopes, and answers route questions,
// so the map never stutters while paths are searched.
import { makeGrid, computeSlope } from './grid.js'
import { createPlanner } from './planner.js'

let g = null
let planner = null

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === 'init') {
      const base = `${msg.base}data/${msg.site}/`
      const meta = await (await fetch(`${base}meta.json`)).json()
      const [dm, night] = await Promise.all([
        fetch(`${base}elevation.i16`).then((r) => r.arrayBuffer()),
        fetch(`${base}themis-night.u8`).then((r) => r.arrayBuffer()),
      ])
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
    self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message ? err.message : err) })
  }
}
