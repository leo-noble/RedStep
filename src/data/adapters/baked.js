// Adapter for the files that scripts/bake-site.mjs writes into public/data/ (NASA, USGS and
// JPL products, baked once so the site runs offline), plus the hand-checked lists in
// src/content/. It turns them into the shapes in src/data/schema.js.
// Works in the page and in the route worker (it only uses fetch).
import { SITES } from '../../content/sites.js'
import { STOPS, HABITAT } from '../../content/science.js'
import { WALK, FACTS } from '../../content/assumptions.js'
import { PANORAMAS } from '../../content/panoramas.js'
import { deviceTier } from '../../lib/quality.js'

const LOW = deviceTier() === 'low'

const ROOT = new URL(import.meta.env.BASE_URL, globalThis.location?.href)
const url = (path) => new URL(`data/${path}`, ROOT).href

/** Download a file. A missing file comes back as the app's HTML page (SPA fallback), so that counts as missing too. */
async function get(path) {
  const r = await fetch(url(path))
  const name = path.split('/').pop()
  if (!r.ok) throw new Error(`could not download ${name} (HTTP ${r.status})`)
  if ((r.headers.get('content-type') || '').includes('text/html')) throw new Error(`${name} is missing from the server`)
  return r
}
const json = async (path) => (await get(path)).json()

/** Download bytes, reporting each chunk's size to onBytes (for progress bars). */
async function bytes(path, onBytes) {
  const r = await get(path)
  if (!onBytes || !r.body) return r.arrayBuffer()
  const reader = r.body.getReader()
  const parts = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value); got += value.length; onBytes(value.length)
  }
  const out = new Uint8Array(got)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out.buffer
}

// Weak devices get the half-size copy of a big photo when the bake made one (scripts/make-lite.mjs).
const layer = (id, L) => ({ ...L, url: url(`${id}/${(LOW && L.lite) || L.file}`), source: L.trekLayer })
const union = (boxes) => boxes.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])

export const baked = {
  id: 'baked',
  label: 'NASA, USGS and JPL products baked into the app (scripts/bake-site.mjs)',

  sites: () => SITES,

  async meta(id) {
    const m = await json(`${id}/meta.json`)
    return {
      id: m.id,
      bbox: m.bbox || union([m.grid?.bbox, m.photo?.bbox, ...Object.values(m.layers).map((L) => L.bbox)].filter(Boolean)),
      center: m.center,
      grid: m.grid,
      photo: m.photo && layer(id, m.photo),
      layers: Object.fromEntries(Object.entries(m.layers).map(([k, L]) => [k, layer(id, L)])),
      traverse: m.traverse ? { ...m.traverse, url: url(`${id}/${m.traverse.file}`) }
        : id === 'jezero' ? { url: url('jezero/perseverance.json'), source: 'NASA JPL MMGIS M20_traverse.json' } : undefined,
    }
  },

  /** Heights (Int16, decimetres) and ground type (THEMIS night IR, 0-255) on the planning grid. */
  async terrain(id, meta, onBytes) {
    const [elev, ground] = await Promise.all([bytes(`${id}/elevation.i16`, onBytes), bytes(`${id}/themis-night.u8`, onBytes)])
    return { meta, elev: new Int16Array(elev), ground: new Uint8Array(ground) }
  },

  places: (id) => ({ home: HABITAT, stops: STOPS[id] || [] }),

  // No hazard catalogue exists in the baked data: steep and loose ground are read from the
  // terrain itself when a walk is planned. Official data can list fixed hazards here.
  hazards: async () => [],

  async traverse(id, meta) {
    if (!meta.traverse) return null
    const t = await (await fetch(meta.traverse.url)).json()
    return Array.isArray(t) ? { line: t, source: meta.traverse.source, lastSol: meta.traverse.lastSol || undefined } : { line: t.line, source: t.source, lastSol: t.lastSol }
  },

  walkInputs: () => ({ settings: WALK, facts: FACTS }),

  /** Real rover panoramas (src/content/panoramas.js, baked by scripts/bake-panoramas.mjs). */
  panoramas: (id) => PANORAMAS.filter((p) => p.site === id).map((p) => ({ ...p, url: url(`panoramas/${LOW ? p.file.replace(/\.webp$/, '-3k.webp') : p.file}`) })),

  names: async () => (await json('names.json')).names,

  backtest: (id) => json(`${id}/backtest.json`),

  /** Whole-planet texture for the intro globe (Viking, MOLA, Blue/Black Marble, LRO). */
  texture: (file) => url(`globe/${file}`),

  /** World-map tile pyramid for a basemap id (viking, mola, dust). */
  tiles: (id) => `${url(`tiles/${id}`)}/{z}/{x}/{y}.jpg`,
}
