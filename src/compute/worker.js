// Web Worker: loads the site's height map, derives slopes, and answers route questions,
// so the map never stutters while paths are searched.
import { makeGrid, computeSlope } from './grid.js'
import { createPlanner } from './planner.js'
import { siteMeta, siteTerrain } from '../data/index.js'

let g = null
let planner = null

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === 'init') {
      const meta = await siteMeta(msg.site)
      // expected bytes: Int16 heights + one byte of ground type per grid cell
      const total = meta.grid.w * meta.grid.h * 3
      let got = 0, last = 0
      const tick = (n) => {
        got += n
        const pct = Math.min(99, Math.round((got / total) * 100))
        if (pct >= last + 2) { last = pct; self.postMessage({ type: 'progress', pct }) }
      }
      const { elev: dm, ground, rough } = await siteTerrain(msg.site, tick)
      self.postMessage({ type: 'progress', pct: 100, stage: 'slopes' })
      g = makeGrid(meta.grid, dm, ground, rough)
      const slope = computeSlope(g)
      planner = createPlanner(g)
      const copy = slope.slice()
      const elev = g.elev.slice()
      const roughCopy = g.rough ? g.rough.slice() : null
      self.postMessage({ type: 'ready', meta, slope: copy, elev, rough: roughCopy, w: g.w, h: g.h, dx: g.dx, dy: g.dy }, roughCopy ? [copy.buffer, elev.buffer, roughCopy.buffer] : [copy.buffer, elev.buffer])
      return
    }
    if (!planner) throw new Error('Planner not ready')
    if (msg.type === 'plan') self.postMessage({ type: 'plan', id: msg.id, ...planner.plan(msg) })
    if (msg.type === 'suggest') self.postMessage({ type: 'suggest', id: msg.id, ...planner.suggest(msg) })
    if (msg.type === 'risky') {
      const r = planner.risky(msg)
      self.postMessage({ type: 'risky', id: msg.id, line: r.line, analysis: r.analysis, why: r.why, stopId: r.stop?.id || null })
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, init: msg.type === 'init', message: String(err && err.message ? err.message : err) })
  }
}
