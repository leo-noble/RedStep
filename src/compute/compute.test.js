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

describe('ground with no height data', () => {
  const opts = (line) => ({ line, settings, facts, habitat: line[0], startMs: Date.UTC(2026, 9, 24, 12), site: { lat: 0.01, lon: 0.01 } })
  it('a walk that leaves the height map is NO-GO, never judged from the edge', () => {
    const g = synth(40, 40, () => -2500) // flat, so only the missing data can stop it
    const r = analyze(g, opts([[0.01, 0.02], [0.06, 0.02]])) // ends 0.02 deg past the east edge
    expect(r.status).toBe('nogo')
    expect(r.reasons[0].code).toBe('nodata')
    expect(r.good.some((t) => t.startsWith('No ground steeper'))).toBe(false)
  })
  it('a gap in the map is NO-GO and the numbers stay finite', () => {
    const g = synth(40, 40, (i) => (i >= 20 && i <= 22 ? -3276.8 : -2500)) // -32768 dm = nodata
    const r = analyze(g, opts([[0.005, 0.02], [0.035, 0.02]]))
    expect(r.status).toBe('nogo')
    expect(r.reasons.some((x) => x.code === 'nodata')).toBe(true)
    expect(Number.isFinite(r.airUsed) && Number.isFinite(r.hours) && Number.isFinite(r.gain)).toBe(true)
  })
  it('a flat walk inside the map stays GO', () => {
    const g = synth(40, 40, () => -2500)
    expect(analyze(g, opts([[0.01, 0.02], [0.02, 0.02]])).status).toBe('go')
  })
})

describe('impossible walks', () => {
  it('a sheer wall gives a NO-GO quickly instead of hanging', () => {
    const g = synth(40, 40, (i) => (i < 20 ? -2500 : 0)) // a 2.5 km wall
    const t0 = Date.now()
    const r = analyze(g, { line: [[0.005, 0.02], [0.035, 0.02]], settings, facts, habitat: [0.005, 0.02], startMs: Date.UTC(2026, 9, 24, 12), site: { lat: 0.01, lon: 0.01 } })
    expect(r.status).toBe('nogo')
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})

describe('carried gear', async () => {
  const { airPerHour, loadFactor } = await import('./walk.js')
  it('adds air use in proportion to the weight carried', () => {
    const none = { ...settings, load: 0 }
    const heavy = { ...settings, load: 15, suitedMass: 150 }
    expect(loadFactor(none)).toBe(1)
    expect(airPerHour(heavy, 0) / airPerHour(none, 0)).toBeCloseTo(1.1, 6)
  })
  it('treats missing settings as no extra gear', () => {
    const { load, suitedMass, ...old } = settings
    expect(loadFactor(old)).toBe(1)
  })
})

describe('rocky ground', () => {
  it('makes rough cells cost more, never forbids them', () => {
    const meta = { w: 2, h: 1, bbox: [0, 0, 0.002, 0.001], nodata: -32768, radius: 3396190, unit: 'metres' }
    const g = makeGrid(meta, new Int16Array([0, 0]), null, new Uint8Array([0, 255]))
    computeSlope(g)
    const c = cellCosts(g, { greenSlope: 10, redSlope: 15 })
    expect(c[1]).toBeGreaterThan(c[0] * 2.5)
    expect(Number.isFinite(c[1])).toBe(true)
  })
})

describe('Gale Crater terrain (USGS HiRISE height map, baked)', () => {
  const dir = new URL('../../public/data/gale/', import.meta.url)
  const meta = JSON.parse(fs.readFileSync(new URL('meta.json', dir), 'utf8'))
  const e = fs.readFileSync(new URL('elevation.i16', dir))
  const g = makeGrid(meta.grid, new Int16Array(e.buffer, e.byteOffset, e.byteLength / 2), new Uint8Array(fs.readFileSync(new URL('themis-night.u8', dir))))

  it('stores deep heights with an offset so they fit', () => {
    expect(meta.grid.offset).toBe(-3000)
    expect(g.elev.every((v) => v > -5000 && v < 0)).toBe(true)
  })

  it('agrees with Curiosity’s own logged heights within 10 m', () => {
    // JPL MMGIS MSL waypoints: [lon, lat, elevation (m)] at sols 3, 4210, 4450 and 5045
    for (const [lon, lat, z] of [[137.441633, -4.589467, -4501], [137.4088596, -4.78571901, -3688], [137.3931242, -4.78692417, -3721], [137.3876138, -4.82466475, -3488]]) {
      expect(Math.abs(elevAt(g, lon, lat) - z)).toBeLessThan(10)
    }
  })
})

describe('buddy walks and rover drop-off', () => {
  const g = synth(200, 20, () => -2500) // flat, so only air and crew matter
  const kmDeg = 1000 / (3396190 * Math.PI / 180)
  const walk = (km, s, extra = {}) => {
    const a = [0.002, 0.01], b = [0.002 + km * kmDeg, 0.01]
    return analyze(g, { line: [a, b], settings: { ...settings, ...s }, facts, habitat: a, startMs: Date.UTC(2026, 9, 24, 12), site: { lat: 0.01, lon: 0.002 }, ...extra })
  }

  it('the suit carrying most sets the air for both', () => {
    const pair = walk(1, { crew: 2, load: 5, buddyLoad: 30 })
    const alone = walk(1, { crew: 1, load: 30 })
    expect(pair.airUsed).toBeCloseTo(alone.airUsed, 6)
    expect(pair.crew.map((c) => c.who)).toEqual(['You', 'Buddy'])
    expect(pair.crew[0].air).toBeLessThan(pair.crew[1].air)
  })

  it('walking alone is a CAUTION', () => {
    expect(walk(1, { crew: 1 }).reasons.some((r) => r.code === 'solo' && r.level === 'caution')).toBe(true)
    expect(walk(1, { crew: 2 }).reasons.some((r) => r.code === 'solo')).toBe(false)
  })

  it('says not to split up when only the lighter suit could finish, and when sharing gear fixes it', () => {
    // 6 km out and back at 2 km/h = 6 h; 10 h suits, 25% reserve: 0 kg uses 60%, 60 kg uses 84%, 30 kg each 72%
    const r = walk(6, { crew: 2, load: 0, buddyLoad: 60, suitHours: 10, reserve: 25, suitedMass: 150, climbCost: 0 })
    const split = r.reasons.find((x) => x.code === 'split')
    expect(split?.level).toBe('nogo')
    expect(split.detail).toMatch(/30 kg each/)
    expect(r.reasons.some((x) => x.code === 'air')).toBe(false)
  })

  it('a rover drive adds time both ways and warns when the rover parks beyond the walk-back circle', () => {
    const r = walk(1, { roverSpeed: 6, walkBack: 5 }, { drive: { m: 6000, straight: 5500 }, base: [0, 0.01] })
    expect(r.drive.hours).toBeCloseTo(1, 6)
    expect(r.tripHours).toBeCloseTo(r.hours + 2, 6)
    expect(r.reasons.some((x) => x.code === 'roverfar')).toBe(true)
    const near = walk(1, { roverSpeed: 6, walkBack: 5 }, { drive: { m: 2000, straight: 1800 }, base: [0, 0.01] })
    expect(near.reasons.some((x) => x.code === 'roverfar')).toBe(false)
  })
})

describe('wrist checklist', async () => {
  const { cuffCard } = await import('../lib/cuff.js')
  const g = synth(100, 20, () => -2500)
  const kmDeg = 1000 / (3396190 * Math.PI / 180)
  const a0 = [0.002, 0.01], b0 = [0.002 + 2 * kmDeg, 0.01]
  const stop = { id: 'x', name: 'Test rock', lon: 0.002 + kmDeg, lat: 0.01, minutes: 30, bring: 'Hammer' }
  const r = analyze(g, { line: [a0, b0], stops: [stop], settings, facts, habitat: a0, startMs: Date.UTC(2026, 9, 24, 12), site: { lat: 0.01, lon: 0.002 } })

  it('lists leave, the stop, the far end and home, in time order', () => {
    const c = cuffCard(r, { stops: [stop], settings })
    expect(c.steps.map((x) => x.what)).toEqual(['Leave the habitat', 'Test rock', 'Turn around at the far end', 'Back at the habitat'])
    for (let k = 1; k < c.steps.length; k++) expect(c.steps[k].t).toBeGreaterThan(c.steps[k - 1].t)
    // the whole walk, in Mars hours
    expect(c.steps.at(-1).t - c.steps[0].t).toBeCloseTo(r.hours / 1.0274912517, 6)
    expect(c.rules.some((x) => /split up/.test(x))).toBe(settings.crew >= 2)
  })
})
