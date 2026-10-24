// Backtest: run the planner's own rules along Perseverance's real path at Jezero.
//   node scripts/backtest.mjs            (needs public/data/jezero from `npm run bake`)
// Writes public/data/jezero/backtest.json, which /sources displays (tagged DERIVED).
//
// 1. Steepness: the whole traverse is sampled every 20 m on the same 40 m slope grid the planner
//    uses, and each stretch is classed with the default limits (easy < 10°, careful 10–15°,
//    too steep > 15°).
// 2. Air budget: every logged drive (one per sol in JPL's file) is treated as a walk out along
//    the rover's line and back, with the default suit model, and checked against the usable air.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeGrid, computeSlope, slopeAt, distance } from '../src/compute/grid.js'
import { analyze, resample } from '../src/compute/walk.js'
import { WALK, FACTS } from '../src/content/assumptions.js'
import { HABITAT } from '../src/content/science.js'
import { instantAtLocalTime } from '../src/lib/mars24.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(ROOT, 'public/data/jezero')
const read = (f) => fs.readFileSync(path.join(dir, f))
const meta = JSON.parse(read('meta.json'))
const e = read('elevation.i16')
const g = makeGrid(meta.grid, new Int16Array(e.buffer, e.byteOffset, e.byteLength / 2), new Uint8Array(read('themis-night.u8')))
computeSlope(g)
const settings = Object.fromEntries(Object.entries(WALK).map(([k, v]) => [k, v.value]))
const facts = Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, v.value]))
const traverse = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-raw/m20/M20_traverse.json'), 'utf8'))

// ---- 1. steepness along the whole path ----
let total = 0
const dist = { easy: 0, careful: 0, steep: 0 }
const flagged = []
let run = null
let outside = 0
for (const f of traverse.features) {
  const coords = f.geometry.coordinates.map((c) => [c[0], c[1]])
  if (coords.length < 2) continue
  const pts = resample(g, coords)
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k]
    const ds = b.d - a.d
    if (ds <= 0) continue
    if (b.lon <= g.west || b.lon >= g.east || b.lat <= g.south || b.lat >= g.north) { outside += ds; continue }
    const s = slopeAt(g, b.lon, b.lat)
    const cls = s > settings.redSlope ? 'steep' : s > settings.greenSlope ? 'careful' : 'easy'
    dist[cls] += ds
    total += ds
    if (cls === 'steep') {
      if (run && run.toKm >= (total - ds) / 1000 - 0.05) { run.toKm = total / 1000; run.maxSlope = Math.max(run.maxSlope, s); run.solTo = f.properties.sol }
      else { run = { fromKm: (total - ds) / 1000, toKm: total / 1000, maxSlope: s, solFrom: f.properties.sol, solTo: f.properties.sol, lon: b.lon, lat: b.lat }; flagged.push(run) }
    }
  }
}
const round = (x, n = 1) => +x.toFixed(n)
const steepRuns = flagged.map((r) => ({ fromKm: round(r.fromKm, 2), toKm: round(r.toKm, 2), lengthM: Math.round((r.toKm - r.fromKm) * 1000), maxSlope: round(r.maxSlope), sols: r.solFrom === r.solTo ? `${r.solFrom}` : `${r.solFrom}–${r.solTo}`, lon: round(r.lon, 5), lat: round(r.lat, 5) }))

// ---- 2. each sol's drive as an out-and-back walk ----
const startMs = instantAtLocalTime(Date.UTC(2026, 9, 24, 12), HABITAT.lon, settings.startHour)
const site = { lat: HABITAT.lat, lon: HABITAT.lon }
let drives = 0, fits = 0, longest = null
const misses = []
for (const f of traverse.features) {
  const coords = f.geometry.coordinates.map((c) => [c[0], c[1]])
  if (coords.length < 2) continue
  const len = coords.slice(1).reduce((s, c, i) => s + distance(g, coords[i], c), 0)
  if (len < 20) continue // localisation-only entries
  drives++
  const a = analyze(g, { line: coords, stops: [], settings: { ...settings, stopMinutes: 0 }, startMs, site, habitat: coords[0], facts })
  const ok = a.airUsed <= a.budget
  if (ok) fits++
  else misses.push({ sol: f.properties.sol, km: round(len / 1000, 2), airUsed: Math.round(a.airUsed * 100) })
  if (!longest || len > longest.m) longest = { sol: f.properties.sol, m: Math.round(len) }
}

// ---- 3. cross-check: our slope from orbit vs the rover's own measured tilt ----
// JPL's waypoints include the rover's tilt (degrees from level) at each stop. Tilt is the slope
// under a 3 m rover; our slope is averaged over 40 m, so we expect it to read lower on rough ground.
const wps = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-raw/m20/M20_waypoints.json'), 'utf8')).features
  .map((f) => f.properties).filter((p) => Number.isFinite(p.tilt) && p.lon > g.west && p.lon < g.east && p.lat > g.south && p.lat < g.north)
const pairs = wps.map((p) => [p.tilt, slopeAt(g, p.lon, p.lat)])
const med = (xs) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)] }
const n = pairs.length
const mean = (i) => pairs.reduce((s, p) => s + p[i], 0) / n
const mt = mean(0), ms = mean(1)
const r = pairs.reduce((s, p) => s + (p[0] - mt) * (p[1] - ms), 0) / Math.sqrt(pairs.reduce((s, p) => s + (p[0] - mt) ** 2, 0) * pairs.reduce((s, p) => s + (p[1] - ms) ** 2, 0))
const tiltCheck = {
  waypoints: n,
  medianRoverTilt: round(med(pairs.map((p) => p[0]))),
  medianOurSlope: round(med(pairs.map((p) => p[1]))),
  medianAbsDiff: round(med(pairs.map((p) => Math.abs(p[0] - p[1])))),
  correlation: round(r, 2),
  roverTiltOver15: pairs.filter((p) => p[0] > settings.redSlope).length,
  weCallCarefulOrSteep: pairs.filter((p) => p[0] > settings.redSlope && p[1] > settings.greenSlope).length,
  weCallTooSteep: pairs.filter((p) => p[0] > settings.redSlope && p[1] > settings.redSlope).length,
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'NASA JPL MMGIS M20_traverse.json (Perseverance drives to sol ' + Math.max(...traverse.features.map((f) => f.properties.sol)) + ')',
  grid: 'MRO CTX height map (USGS), 20 m averaged to 40 m',
  limits: { greenSlope: settings.greenSlope, redSlope: settings.redSlope },
  steepness: {
    pathKm: round(total / 1000, 2),
    outsideGridKm: round(outside / 1000, 2),
    pctEasy: round((dist.easy / total) * 100),
    pctCareful: round((dist.careful / total) * 100),
    pctTooSteep: round((dist.steep / total) * 100, 2),
    passesPct: round(((dist.easy + dist.careful) / total) * 100, 2),
    flaggedStretches: steepRuns.length,
    flagged: steepRuns,
  },
  air: {
    suit: { suitHours: settings.suitHours, reservePct: settings.reserve, flatPaceKmh: settings.flatPace, climbCostPctPer10pct: settings.climbCost },
    drives,
    fitWithinBudget: fits,
    fitPct: round((fits / drives) * 100, 1),
    longestDrive: longest,
    tooLongForAWalk: misses.sort((a, b) => b.km - a.km).slice(0, 10),
  },
  tiltCheck,
}
fs.writeFileSync(path.join(dir, 'backtest.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify({ steepness: { ...out.steepness, flagged: out.steepness.flagged.length }, air: { ...out.air, suit: undefined }, tiltCheck }, null, 1))
