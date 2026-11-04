import { describe, expect, it } from 'vitest'
import { dailyMean, yearOfSun, MARS_MEAN_IRRADIANCE } from './insolation.js'

describe('insolation', () => {
  it('gives S/π at the equator at equinox and mean distance', () => {
    expect(dailyMean(0, 0, 1.52366231)).toBeCloseTo(MARS_MEAN_IRRADIANCE / Math.PI, 6)
  })

  it('is zero in polar night', () => {
    expect(dailyMean(-80, 20, 1.52)).toBe(0)
  })

  it('gives the equator more sun over a year than the mid-latitudes', () => {
    const eq = yearOfSun(0)
    const mid = yearOfSun(42)
    expect(eq.mean).toBeGreaterThan(mid.mean)
    expect(mid.min).toBeLessThan(eq.min)
    // a planet-wide yearly mean at the equator sits near S/π, within the orbit's swing
    expect(eq.mean).toBeGreaterThan(160)
    expect(eq.mean).toBeLessThan(200)
  })
})
