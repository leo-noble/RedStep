// The shape of every piece of Mars data the app uses. Adapters (src/data/adapters/*) must return
// exactly these shapes; src/data/index.js checks them, so a new data source that is missing a
// field fails loudly with a readable message instead of breaking a page. Full description with
// examples: docs/data-schema.md.

/**
 * @typedef {[number, number]} LonLat  planetocentric degrees, longitude EAST (-180..360)
 * @typedef {[number, number, number, number]} BBox  [west, south, east, north] in degrees
 * @typedef {'nasa'|'derived'|'illustrative'} Badge  the three honesty tags
 *
 * @typedef {object} ImageLayer  a picture draped over the map
 * @property {string} url
 * @property {BBox} bbox
 * @property {string} [source]  product or layer name, for credits
 *
 * @typedef {object} TerrainGrid  the walk-planning height map
 * @property {number} w  columns
 * @property {number} h  rows
 * @property {BBox} bbox
 * @property {[number, number]} cellDeg  cell size in degrees [lon, lat]
 * @property {'decimetres'|'metres'} unit
 * @property {number} nodata
 * @property {number} radius  planet radius in metres used for distances
 *
 * @typedef {object} SiteMeta
 * @property {string} id
 * @property {BBox} bbox  area covered by the site's maps
 * @property {LonLat} [center]
 * @property {TerrainGrid} [grid]  only for sites where walks can be planned
 * @property {ImageLayer} [photo]  main photo map (planner sites)
 * @property {Object<string, ImageLayer>} layers  keyed by layer id (viking, relief, hirise, themis-day …)
 * @property {{url: string, source: string, lastSol?: number}} [traverse]
 *
 * @typedef {object} Terrain  what the route worker needs
 * @property {SiteMeta} meta
 * @property {Int16Array} elev  heights, row-major from the north-west corner, in grid.unit
 * @property {Uint8Array} ground  0-255 per cell; low = loose/dark ground (THEMIS night IR today)
 *
 * @typedef {object} Place  a point of interest
 * @property {string} id
 * @property {string} name
 * @property {number} lon
 * @property {number} lat
 *
 * @typedef {Place & {value: number, minutes: number, region: string, what: string, why: string, evidence: string, bring: string}} ScienceStop
 *
 * @typedef {object} Hazard  a known danger at a fixed place (in addition to slope and loose ground,
 *   which the planner reads from the terrain itself)
 * @property {string} id
 * @property {'steep'|'loose'|'rocks'|'dust'|'other'} kind
 * @property {number} lon
 * @property {number} lat
 * @property {number} [radiusM]
 * @property {string} note  one plain sentence
 * @property {string} source  where it comes from
 * @property {Badge} badge
 *
 * @typedef {object} Traverse  a rover's real path
 * @property {LonLat[]} line
 * @property {string} source
 * @property {number} [lastSol]
 *
 * @typedef {object} Panorama  a real rover panorama for Street view
 * @property {string} id
 * @property {string} site
 * @property {string} name  place name
 * @property {number} lon  where the rover stood
 * @property {number} lat
 * @property {string} where  how the position was worked out
 * @property {string} rover
 * @property {string} instrument
 * @property {string} sol  sol or range of sols the images were taken
 * @property {string} date
 * @property {string} pia  NASA Photojournal id
 * @property {string} credit  exact credit line from NASA
 * @property {string} page  NASA page for the image
 * @property {string} url  the web-sized image
 * @property {number} fov  horizontal field of view in degrees (360 = full circle)
 * @property {string} alt  text alternative
 * @property {string} [colour]  how NASA processed the colours, when the caption says
 *
 * @typedef {object} Assumption  one walk input (see src/content/assumptions.js)
 * @property {string} label
 * @property {number} value
 * @property {string} unit
 * @property {Badge} badge
 */

export class DataError extends Error {
  constructor(what, problem) {
    super(`${what}: ${problem}`)
    this.name = 'DataError'
  }
}

const num = (x) => typeof x === 'number' && Number.isFinite(x)
const isBBox = (b) => Array.isArray(b) && b.length === 4 && b.every(num) && b[0] < b[2] && b[1] < b[3]
const isLonLat = (p) => Array.isArray(p) && p.length >= 2 && num(p[0]) && num(p[1]) && Math.abs(p[1]) <= 90
const need = (ok, what, problem) => { if (!ok) throw new DataError(what, problem) }

/** @returns {SiteMeta} */
export function checkMeta(m, id) {
  const what = `site data for "${id}"`
  need(m && typeof m === 'object', what, 'missing')
  need(m.id === id, what, `id is "${m.id}"`)
  need(isBBox(m.bbox), what, 'bbox must be [west, south, east, north]')
  need(m.layers && typeof m.layers === 'object', what, 'layers missing')
  for (const [k, L] of Object.entries(m.layers)) need(L && typeof L.url === 'string' && isBBox(L.bbox), what, `layer "${k}" needs url and bbox`)
  if (m.grid) {
    const g = m.grid
    need(Number.isInteger(g.w) && Number.isInteger(g.h) && g.w > 2 && g.h > 2, what, 'grid w/h must be whole numbers')
    need(isBBox(g.bbox) && Array.isArray(g.cellDeg) && g.cellDeg.every(num), what, 'grid needs bbox and cellDeg')
    need(['decimetres', 'metres'].includes(g.unit) && num(g.nodata) && num(g.radius), what, 'grid needs unit, nodata and radius')
    need(m.photo && typeof m.photo.url === 'string' && isBBox(m.photo.bbox), what, 'planner sites need a photo layer')
  }
  if (m.traverse) need(typeof m.traverse.url === 'string', what, 'traverse needs a url')
  return m
}

/** @returns {Terrain} */
export function checkTerrain(t, id) {
  const what = `terrain for "${id}"`
  const g = t.meta.grid
  need(g, what, 'this site has no height map')
  need(t.elev instanceof Int16Array && t.elev.length === g.w * g.h, what, `expected ${g.w * g.h} heights, got ${t.elev?.length}`)
  need(t.ground instanceof Uint8Array && t.ground.length === g.w * g.h, what, `expected ${g.w * g.h} ground values, got ${t.ground?.length}`)
  return t
}

/** @returns {{home: Place, stops: ScienceStop[]}} */
export function checkPlaces(p, id) {
  const what = `places for "${id}"`
  need(p && p.home && num(p.home.lon) && num(p.home.lat), what, 'home needs lon and lat')
  need(Array.isArray(p.stops), what, 'stops must be a list')
  for (const s of p.stops) need(s.id && s.name && num(s.lon) && num(s.lat) && num(s.value) && num(s.minutes), what, `stop "${s.id || '?'}" needs id, name, lon, lat, value and minutes`)
  return p
}

/** @returns {Hazard[]} */
export function checkHazards(list, id) {
  const what = `hazards for "${id}"`
  need(Array.isArray(list), what, 'must be a list')
  for (const h of list) need(h.id && ['steep', 'loose', 'rocks', 'dust', 'other'].includes(h.kind) && num(h.lon) && num(h.lat) && h.note && h.source && ['nasa', 'derived', 'illustrative'].includes(h.badge), what, `hazard "${h.id || '?'}" is incomplete`)
  return list
}

/** @returns {Traverse} */
export function checkTraverse(t, id) {
  const what = `rover path for "${id}"`
  need(t && Array.isArray(t.line) && t.line.length > 1 && t.line.every(isLonLat), what, 'line must be a list of [lon, lat]')
  need(typeof t.source === 'string', what, 'source missing')
  return t
}

/** @returns {Panorama[]} */
export function checkPanoramas(list, id) {
  const what = `panoramas for "${id}"`
  need(Array.isArray(list), what, 'must be a list')
  for (const p of list) {
    need(p.id && p.name && num(p.lon) && num(p.lat) && p.where, what, `panorama "${p.id || '?'}" needs id, name, lon, lat and where`)
    need(p.rover && p.instrument && p.sol && p.date && p.pia && p.credit && p.page && p.url, what, `panorama "${p.id}" needs rover, instrument, sol, date, pia, credit, page and url`)
    need(num(p.fov) && p.fov > 0 && p.fov <= 360 && p.alt, what, `panorama "${p.id}" needs fov and alt`)
  }
  return list
}
