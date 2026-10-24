import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { makeGrid, computeSlope, elevAt, distance } from './grid.js'
import { astar, cellCosts, cellOf } from './pathfind.js'
import { analyze, pace } from './walk.js'
import { createPlanner } from './planner.js'
import { WALK, FACTS } from '../content/assumptions.js'

const settings = Object.fromEntries(Object.entries(WALK).map(([k, v]) => [k, v.value]))
const facts = Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, v.value]))

// Synthetic grid: w x h cells near the equator, heights from fn(i, j) in metres.
function synth(w, h, fn) {
  const dLon = 0.001, dLat = 0.001
  const meta = { w, h, bbox: [0, 0, w * dLon, h * dLat], nodata: -32768, radius: 3396190 }
  const dm = new Int16Array(w * h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dm[j * w + i] = Math.round(fn(i, j) * 10)
  const g = makeGrid(meta, dm)
  computeSlope(g)
  return g
}

describe('slope from a height map', () => {
  it('recovers the gradient of a known ramp', () => {
    // rises 1 m for every metre east of... use 10% grade: atan(0.1) = 5.71 deg
    const cell = 3396190 * 0.001 * Math.PI / 180
    const g = synth(60, 60, (i) => i * cell * 0.1)
    const s = g.slope[30 * 60 + 30]
    expect(s).toBeCloseTo(Math.atan(0.1) * 180 / Math.PI, 1)
  })
  it('a flat plain is 0 degrees', () => {
    const g = synth(20, 20, () => -2500)
    expect(g.slope[10 * 20 + 10]).toBeCloseTo(0, 5)
  })
})

describe('safe path', () => {
  it('goes around a cliff wall instead of over it', () => {
    // a 40 m wall along column 30, except a gap near the bottom
    const g = synth(60, 60, (i, j) => (i === 30 && j < 50 ? 40 : 0))
    const costs = cellCosts(g, settings)
    const path = astar(g, costs, cellOf(g, 0.005, 0.03), cellOf(g, 0.055, 0.03))
    expect(path).not.toBeNull()
    const rows = path.map((c) => (c / g.w) | 0)
    expect(Math.max(...rows)).toBeGreaterThanOrEqual(50) // it detoured through the gap
  })
})

describe('walk analysis', () => {
  it('Tobler pace: flat gives the flat speed, uphill is slower', () => {
    expect(pace(2, 0)).toBeCloseTo(2, 6)
    expect(pace(2, 0.1)).toBeLessThan(2)
  })
  it('a 1 km flat walk at 2 km/h takes about an hour there and back', () => {
    const g = synth(100, 20, () => -2500)
    const a = [0.001, 0.01], b = [0.001 + 1000 / (3396190 * Math.PI / 180), 0.01]
    const r = analyze(g, {
      line: [a, b], settings, facts, habitat: a,
      startMs: Date.UTC(2026, 9, 24, 12), site: { lat: 0.01, lon: 0.001 },
    })
    expect(r.distance).toBeCloseTo(1000, -1)
    expect(r.hours).toBeCloseTo(1, 1)
    expect(r.maxSlope).toBeLessThan(0.5)
    expect(r.turnBack.atEnd).toBe(true)
  })
})

// Real Jezero data (skipped if the bake has not been run).
const base = new URL('../../public/data/jezero/', import.meta.url)
const hasData = fs.existsSync(new URL('meta.json', base))
const i16 = (b) => new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2)
describe.skipIf(!hasData)('Jezero', () => {
  const meta = hasData ? JSON.parse(fs.readFileSync(new URL('meta.json', base))) : null
  const g = hasData ? makeGrid(meta.grid, i16(fs.readFileSync(new URL('elevation.i16', base))), new Uint8Array(fs.readFileSync(new URL('themis-night.u8', base)))) : null
  it('landing site height matches the rover’s own record (-2570 m) within 15 m', () => {
    expect(Math.abs(elevAt(g, 77.45088572, 18.44462715) - -2569.9)).toBeLessThan(15)
  })
  it('suggests a route that is not NO-GO', async () => {
    const { STOPS, HABITAT } = await import('../content/science.js')
    const p = createPlanner(g)
    const startMs = Date.UTC(2026, 9, 24, 0)
    const site = { lat: HABITAT.lat, lon: HABITAT.lon }
    const { instantAtLocalTime } = await import('../lib/mars24.js')
    const r = p.suggest({ habitat: [HABITAT.lon, HABITAT.lat], stops: STOPS.jezero, settings, facts, site, startMs: instantAtLocalTime(startMs, site.lon, 9) })
    expect(r.chosen.length).toBeGreaterThan(0)
    expect(r.analysis.status).not.toBe('nogo')
    expect(distance(g, r.line[0], [HABITAT.lon, HABITAT.lat])).toBeLessThan(1)
  }, 30000)
})

describe.skipIf(!hasData)('Jezero risky walk', () => {
  it('finds a straight walk from the terrain that is NO-GO for steep ground', async () => {
    const meta = JSON.parse(fs.readFileSync(new URL('meta.json', base)))
    const g = makeGrid(meta.grid, i16(fs.readFileSync(new URL('elevation.i16', base))), new Uint8Array(fs.readFileSync(new URL('themis-night.u8', base))))
    const { STOPS, HABITAT } = await import('../content/science.js')
    const { instantAtLocalTime } = await import('../lib/mars24.js')
    const site = { lat: HABITAT.lat, lon: HABITAT.lon }
    const r = createPlanner(g).risky({ habitat: [HABITAT.lon, HABITAT.lat], stops: STOPS.jezero, settings, facts, site, startMs: instantAtLocalTime(Date.UTC(2026, 9, 24), site.lon, 9) })
    expect(r.analysis.status).toBe('nogo')
    expect(r.why).toBe('steep')
    expect(r.analysis.maxSlope).toBeGreaterThan(settings.redSlope)
  }, 30000)
})
