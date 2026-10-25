// The one door to Mars data. Pages, the map and the route worker read terrain, places, hazards,
// rover paths and walk inputs only through these functions, never from files directly.
//
// To switch data source (for example NASA's official Space Apps dataset), write an adapter in
// src/data/adapters/ that returns the shapes in src/data/schema.js, add it to ADAPTERS, and set
// VITE_MARS_DATA=<its id> (or change DEFAULT). No page code changes. See docs/data-schema.md.
import { baked } from './adapters/baked.js'
import { checkHazards, checkMeta, checkPanoramas, checkPlaces, checkTerrain, checkTraverse } from './schema.js'

export { DataError } from './schema.js'

const ADAPTERS = { baked }
const DEFAULT = 'baked'
const source = ADAPTERS[import.meta.env.VITE_MARS_DATA] || ADAPTERS[DEFAULT]

/** Which data source is active (shown on /sources). */
export const dataSource = { id: source.id, label: source.label }

// each file is downloaded once per page load
const cache = new Map()
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make().catch((e) => { cache.delete(key); throw e }))
  return cache.get(key)
}

/** All curated sites (id, name, lat, lon, planner, …). */
export const SITES = source.sites()
export const siteById = (id) => SITES.find((s) => s.id === id)

/** Walk inputs: suit, pace and limit assumptions (WALK) and fixed facts (FACTS), each {label, value, unit, badge, …}. */
export const { settings: WALK, facts: FACTS } = source.walkInputs()

/** Maps and grid description for one site. @returns {Promise<import('./schema.js').SiteMeta>} */
export const siteMeta = (id) => once(`meta:${id}`, async () => checkMeta(await source.meta(id), id))

/** Height map and ground type for walk planning. onBytes(n) reports download progress. */
export async function siteTerrain(id, onBytes) {
  const meta = await siteMeta(id)
  return checkTerrain(await source.terrain(id, meta, onBytes), id)
}

/** Home base and science stops. */
export const sitePlaces = (id) => checkPlaces(source.places(id), id)

/** Known fixed hazards (slope and loose ground come from the terrain, not from this list). */
export const siteHazards = (id) => once(`hazards:${id}`, async () => checkHazards(await source.hazards(id), id))

/** A rover's real path at the site, or null when there is none. */
export const siteTraverse = (id) => once(`traverse:${id}`, async () => {
  const t = await source.traverse(id, await siteMeta(id))
  return t && checkTraverse(t, id)
})

/** Real rover panoramas taken at the site (Street view). Empty when there are none. */
export const sitePanoramas = (id) => checkPanoramas(source.panoramas?.(id) || [], id)

/** IAU place names for search and labels. */
export const placeNames = () => once('names', () => source.names())

/** Backtest of the planner's rules along the rover's real path (DERIVED). */
export const backtest = (id) => once(`backtest:${id}`, () => source.backtest(id))

/** URL template for a world-map tile pyramid. */
export const basemapTiles = (id) => source.tiles(id)

/** URL of a whole-planet texture for the intro globe. */
export const globeTexture = (file) => source.texture(file)
