import { describe, expect, it } from 'vitest'
import { startWindow } from './startWindow.js'
import { instantAtLocalTime, sunAt } from './mars24.js'

const JEZERO = { lat: 18.4446, lon: 77.4509 }
const dateMs = Date.parse('2026-11-03T12:00:00Z')

describe('startWindow', () => {
  it('finds a window around midday for a short walk', () => {
    const w = startWindow({ dateMs, ...JEZERO, hours: 2.5, minSun: 10 })
    expect(w).not.toBeNull()
    expect(w.earliest).toBeLessThan(12)
    expect(w.latest).toBeGreaterThan(w.earliest)
    expect(w.best).toBeGreaterThanOrEqual(w.earliest)
    expect(w.best).toBeLessThanOrEqual(w.latest)
    expect(w.bestMin).toBeGreaterThanOrEqual(10)
  })

  it('keeps the sun above the limit for the whole walk at both ends of the window', () => {
    const hours = 2.5
    const w = startWindow({ dateMs, ...JEZERO, hours, minSun: 10 })
    for (const h of [w.earliest, w.latest]) {
      const t0 = instantAtLocalTime(dateMs, JEZERO.lon, h)
      for (let k = 0; k <= 30; k++) expect(sunAt(t0 + (hours * 3.6e6 * k) / 30, JEZERO.lat, JEZERO.lon).elevation).toBeGreaterThanOrEqual(9.5)
    }
  })

  it('returns null when no start can keep the sun high enough', () => {
    expect(startWindow({ dateMs, ...JEZERO, hours: 11, minSun: 30 })).toBeNull()
  })
})
