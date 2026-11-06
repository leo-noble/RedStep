import { describe, expect, it } from 'vitest'
import { classify, S1_PFU } from './spaceWeather.js'
import { earthMars } from './ephem.js'

const now = Date.UTC(2026, 10, 6, 12)
const h = 3.6e6

describe('space weather', () => {
  it('reports nothing known when every source failed', () => {
    expect(classify({ donki: false, goes: null, checkedAt: now }, now).known).toBe(false)
  })

  it('calls a quiet week quiet and names the strongest flare', () => {
    const w = classify({ donki: true, flares: [{ cls: 'C2.1', at: now - 30 * h }, { cls: 'C9.0', at: now - 5 * h }], seps: [], goes: { flux: 0.4, at: now }, checkedAt: now }, now)
    expect(w.level).toBe('quiet')
    expect(w.storm).toBe(false)
    expect(w.strongest.cls).toBe('C9.0')
  })

  it('flags a storm from a recent particle event or from proton flux at S1', () => {
    expect(classify({ donki: true, flares: [], seps: [{ at: now - 20 * h }], goes: null, checkedAt: now }, now).storm).toBe(true)
    expect(classify({ donki: false, flares: null, seps: null, goes: { flux: S1_PFU, at: now }, checkedAt: now }, now).storm).toBe(true)
    // an event older than three days no longer counts as on-going
    expect(classify({ donki: true, flares: [], seps: [{ at: now - 80 * h }], goes: null, checkedAt: now }, now).storm).toBe(false)
  })

  it('marks big flares as active', () => {
    expect(classify({ donki: true, flares: [{ cls: 'X1.1', at: now - h }], seps: [], goes: null, checkedAt: now }, now).level).toBe('active')
  })

  it('gives an Earth-Sun-Mars angle between 0 and 180 degrees', () => {
    const a = earthMars(now).apart
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(180)
  })
})
