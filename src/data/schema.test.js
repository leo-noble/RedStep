import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { checkHazards, checkMeta, checkPlaces, checkTerrain, checkTraverse, DataError } from './schema.js'
import { STOPS, HABITAT } from '../content/science.js'

const raw = JSON.parse(fs.readFileSync('public/data/jezero/meta.json', 'utf8'))
// the baked adapter adds a url to every image layer
const withUrls = (m) => ({
  ...m,
  bbox: m.grid.bbox,
  photo: { ...m.photo, url: 'x' },
  layers: Object.fromEntries(Object.entries(m.layers).map(([k, L]) => [k, { ...L, url: 'x' }])),
})

describe('data schema', () => {
  it('accepts the baked Jezero data', () => {
    const meta = checkMeta(withUrls(raw), 'jezero')
    const n = meta.grid.w * meta.grid.h
    expect(() => checkTerrain({ meta, elev: new Int16Array(n), ground: new Uint8Array(n) }, 'jezero')).not.toThrow()
    expect(() => checkPlaces({ home: HABITAT, stops: STOPS.jezero }, 'jezero')).not.toThrow()
    const p = JSON.parse(fs.readFileSync('public/data/jezero/perseverance.json', 'utf8'))
    expect(() => checkTraverse({ line: p.line, source: p.source }, 'jezero')).not.toThrow()
  })

  it('names the problem when data is incomplete', () => {
    expect(() => checkMeta({ ...withUrls(raw), grid: { ...raw.grid, unit: 'feet' } }, 'jezero')).toThrow(/unit/)
    const meta = withUrls(raw)
    expect(() => checkTerrain({ meta, elev: new Int16Array(10), ground: new Uint8Array(10) }, 'jezero')).toThrow(DataError)
    expect(() => checkPlaces({ home: HABITAT, stops: [{ id: 'a', name: 'A', lon: 1 }] }, 'jezero')).toThrow(/stop "a"/)
    expect(() => checkHazards([{ id: 'h', kind: 'lava', lon: 0, lat: 0, note: 'n', source: 's', badge: 'nasa' }], 'jezero')).toThrow(/hazard "h"/)
    expect(() => checkTraverse({ line: [[0, 0]], source: 's' }, 'jezero')).toThrow(/line/)
  })
})
