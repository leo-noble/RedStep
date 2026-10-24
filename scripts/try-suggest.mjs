// Dev check: run the planner on the baked Jezero data and print the result.
import fs from 'node:fs'
import { makeGrid } from '../src/compute/grid.js'
import { createPlanner } from '../src/compute/planner.js'
import { WALK, FACTS } from '../src/content/assumptions.js'
import { STOPS, HABITAT } from '../src/content/science.js'
import { instantAtLocalTime } from '../src/lib/mars24.js'
const b = (f) => fs.readFileSync(new URL(`../public/data/jezero/${f}`, import.meta.url))
const meta = JSON.parse(b('meta.json'))
const e = b('elevation.i16')
const g = makeGrid(meta.grid, new Int16Array(e.buffer, e.byteOffset, e.byteLength / 2), new Uint8Array(b('themis-night.u8')))
const settings = Object.fromEntries(Object.entries(WALK).map(([k, v]) => [k, v.value]))
const facts = Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, v.value]))
const p = createPlanner(g)
const site = { lat: HABITAT.lat, lon: HABITAT.lon }
const startMs = instantAtLocalTime(Date.now(), site.lon, settings.startHour)
for (const appetite of [0.6, 0.85, 1]) {
  const t0 = performance.now()
  const r = p.suggest({ habitat: [HABITAT.lon, HABITAT.lat], stops: STOPS.jezero, settings, facts, site, startMs, appetite })
  const a = r.analysis
  console.log(appetite, (performance.now() - t0).toFixed(0) + 'ms', r.chosen.join(','), a.status, (a.distance / 1000).toFixed(2) + 'km out', a.hours.toFixed(2) + 'h', 'air', a.airUsed.toFixed(2), 'maxSlope', a.maxSlope.toFixed(1), 'far', (a.farthest / 1000).toFixed(2), 'sun', a.sun.start.elevation.toFixed(0), a.sun.min.toFixed(0), 'maxH', r.maxHours.toFixed(1), a.reasons.map((x) => x.code).join(','))
}
// A straight line from the habitat to Cheyava Falls: should be NO-GO
const ch = STOPS.jezero.find((s) => s.id === 'cheyava')
const r = p.plan({ waypoints: [[HABITAT.lon, HABITAT.lat], [ch.lon, ch.lat]], snap: [false], stops: [ch], settings, facts, site, startMs, habitat: [HABITAT.lon, HABITAT.lat] })
console.log('straight to Cheyava:', r.analysis.status, r.analysis.reasons.map((x) => x.title).join(' | '), 'maxSlope', r.analysis.maxSlope.toFixed(1))
const w = STOPS.jezero.find((s) => s.id === 'wildcat')
for (const snap of [false, true]) {
  const q = p.plan({ waypoints: [[HABITAT.lon, HABITAT.lat], [w.lon, w.lat]], snap: [snap], stops: [w], settings, facts, site, startMs, habitat: [HABITAT.lon, HABITAT.lat] })
  console.log('to Wildcat snap', snap, q.analysis.status, q.analysis.reasons.map((x) => x.title).join(' | '), 'maxSlope', q.analysis.maxSlope.toFixed(1), (q.analysis.distance / 1000).toFixed(2), 'km')
}
