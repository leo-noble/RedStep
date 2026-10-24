import { describe, expect, it } from 'vitest'
import { marsTime, sunAt } from './mars24.js'
import { earthMars } from './ephem.js'

// Worked examples from https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
describe('Mars24 worked example 1 (2000-01-06 00:00 UTC, 0E 0N)', () => {
  const ms = 947116800000
  const t = marsTime(ms)
  const s = sunAt(ms, 0, 0, t)
  it('orbit', () => {
    expect(t.M).toBeCloseTo(21.74558, 4)
    expect(t.Ls).toBeCloseTo(277.18758, 4)
    expect(t.eot).toBeCloseTo(-5.18774, 4)
  })
  it('time', () => {
    expect(t.mst).toBeCloseTo(23.99425, 4)
    expect(s.ltst).toBeCloseTo(23.6484, 3)
    expect(t.subLonW).toBeCloseTo(174.726, 3)
  })
  it('sun', () => {
    expect(t.dec).toBeCloseTo(-25.22825, 4)
    expect(t.rAU).toBeCloseTo(1.39358, 4)
    expect(t.helioLon).toBeCloseTo(2.26352, 4)
    expect(t.helioLat).toBeCloseTo(-1.35957, 4)
    expect(s.zenith).toBeCloseTo(154.26182, 3)
    expect(s.azimuth).toBeCloseTo(191.03905, 3)
  })
})

describe('Mars24 worked example 2 (Spirit landing site)', () => {
  const ms = 1073137591000
  const lonE = 360 - 184.702
  const t = marsTime(ms)
  const s = sunAt(ms, -14.64, lonE, t)
  it('local true solar time is midnight, sun due south', () => {
    expect(t.Ls).toBeCloseTo(327.32416, 4)
    expect(t.mst).toBeCloseTo(13.16537, 4)
    expect(s.ltst).toBeCloseTo(0.00025, 3)
    expect(s.zenith).toBeCloseTo(151.93895, 2) // page rounds the site longitude
    expect(s.azimuth).toBeCloseTo(179.99383, 2)
  })
})

describe('Earth-Mars distance', () => {
  it('2025 close approach ~0.642 AU (12 Jan 2025)', () => {
    expect(earthMars(Date.UTC(2025, 0, 12)).au).toBeCloseTo(0.642, 2)
  })
  it('2023 solar conjunction (18 Nov 2023) ~2.47 AU, Sun angle small', () => {
    const r = earthMars(Date.UTC(2023, 10, 18))
    expect(r.au).toBeGreaterThan(2.4)
    expect(r.sunAngle).toBeLessThan(2)
  })
})
