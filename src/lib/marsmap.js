// Helpers for drawing Mars in MapLibre.
// MapLibre only knows Web Mercator on an Earth-sized sphere. We feed it Mars latitude/longitude
// directly (degrees are degrees on any sphere) and do every distance ourselves on Mars's radius.
// Heights for 3D terrain are multiplied by R_earth / R_mars so that 1x exaggeration is true scale.
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre 6 loads its own worker relative to its module; point it at the copy Vite emits.
maplibregl.setWorkerUrl(workerUrl)

export const R_MARS = 3396190
export const EARTH_OVER_MARS = 6378137 / R_MARS
const D = Math.PI / 180

/** Corner coordinates for a MapLibre image source from [w, s, e, n]. */
export const corners = ([w, s, e, n]) => [[w, n], [e, n], [e, s], [w, s]]

/** Metres per screen pixel on Mars at this zoom and latitude (512 px tiles). */
export const marsMetresPerPixel = (zoom, lat) => (2 * Math.PI * R_MARS * Math.cos(lat * D)) / (512 * 2 ** zoom)

/** Geodesic circle as a GeoJSON polygon, radius in metres on Mars. */
export function circle(lon, lat, radius, steps = 128) {
  const ring = []
  const ang = radius / R_MARS
  const la = lat * D, lo = lon * D
  for (let i = 0; i <= steps; i++) {
    const b = (i / steps) * 2 * Math.PI
    const la2 = Math.asin(Math.sin(la) * Math.cos(ang) + Math.cos(la) * Math.sin(ang) * Math.cos(b))
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(ang) * Math.cos(la), Math.cos(ang) - Math.sin(la) * Math.sin(la2))
    ring.push([lo2 / D, la2 / D])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

const lerp = (a, b, t) => a + (b - a) * t
// rust ramp for height: deep shadow -> rust -> ember -> pale dust
const RAMP = [[0, [26, 12, 8]], [0.25, [92, 38, 20]], [0.5, [178, 82, 44]], [0.75, [236, 140, 80]], [1, [250, 222, 190]]]
function ramp(t) {
  for (let i = 0; i < RAMP.length - 1; i++) {
    const [a, ca] = RAMP[i], [b, cb] = RAMP[i + 1]
    if (t <= b) { const k = (t - a) / (b - a); return [lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k)] }
  }
  return RAMP[RAMP.length - 1][1]
}

/** Height colours with hillshade (sun from the north-west, 35 deg up), as a PNG blob URL. */
export async function paintElevation({ w, h, elev, dx, dy }, zMin, zMax) {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  const az = 315 * D, alt = 35 * D
  const lx = Math.sin(az) * Math.cos(alt), ly = Math.cos(az) * Math.cos(alt), lz = Math.sin(alt)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i
    const z = elev[k]
    const zl = elev[j * w + Math.max(0, i - 1)], zr = elev[j * w + Math.min(w - 1, i + 1)]
    const zu = elev[Math.max(0, j - 1) * w + i], zd = elev[Math.min(h - 1, j + 1) * w + i]
    const gx = (zr - zl) / (2 * dx), gy = (zu - zd) / (2 * dy) // gy positive = rising northward
    const nl = Math.hypot(gx, gy, 1)
    const shade = Math.max(0, (-gx * lx - gy * ly + lz) / nl)
    const t = Math.max(0, Math.min(1, (z - zMin) / (zMax - zMin)))
    const [r, g, b] = ramp(Math.pow(t, 0.8))
    const s = 0.35 + 0.95 * shade
    img.data[k * 4] = Math.min(255, r * s)
    img.data[k * 4 + 1] = Math.min(255, g * s)
    img.data[k * 4 + 2] = Math.min(255, b * s)
    img.data[k * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return URL.createObjectURL(await c.convertToBlob({ type: 'image/png' }))
}

/** Slope classes: transparent below green, green / amber / red bands. */
export async function paintSlope({ w, h, slope }, green, red) {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let k = 0; k < w * h; k++) {
    const s = slope[k]
    let col
    if (s > red) col = [255, 96, 80, 215]
    else if (s > green) col = [255, 200, 100, 150]
    else col = [0, 0, 0, 0]
    img.data.set(col, k * 4)
  }
  ctx.putImageData(img, 0, 0)
  return URL.createObjectURL(await c.convertToBlob({ type: 'image/png' }))
}

/** Rocky-looking ground (HiRISE texture score 0..255): clear when smooth, warming to a rust red
 *  where the photo shows the most boulders and broken rock. */
export async function paintRough({ w, h, rough }) {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let k = 0; k < w * h; k++) {
    const t = Math.max(0, (rough[k] - 110) / 145)
    if (t <= 0) continue
    img.data.set([255, Math.round(180 - 90 * t), Math.round(90 - 50 * t), Math.round(40 + 175 * t)], k * 4)
  }
  ctx.putImageData(img, 0, 0)
  return URL.createObjectURL(await c.convertToBlob({ type: 'image/png' }))
}

/**
 * Register a `marsdem://z/x/y` protocol that renders Terrarium-encoded height tiles straight
 * from the in-memory grid, so 3D terrain needs no tile files. Outside the grid we use its
 * lowest height so the edges sit flat.
 */
export function registerDem(name, grid, bbox) {
  const [w, s, e, n] = bbox
  const { w: gw, h: gh, elev } = grid
  let floor = Infinity
  for (const v of elev) if (v < floor) floor = v
  const sample = (lon, lat) => {
    const fx = ((lon - w) / (e - w)) * gw - 0.5, fy = ((n - lat) / (n - s)) * gh - 0.5
    if (fx < 0 || fy < 0 || fx > gw - 1 || fy > gh - 1) return floor
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
    const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1)
    const a = elev[y0 * gw + x0], b = elev[y0 * gw + x1], c = elev[y1 * gw + x0], d = elev[y1 * gw + x1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }
  maplibregl.removeProtocol?.(name)
  maplibregl.addProtocol(name, async (params) => {
    const [z, x, y] = params.url.replace(`${name}://`, '').split('/').map(Number)
    const size = 256
    const c = new OffscreenCanvas(size, size)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(size, size)
    const n2 = 2 ** z
    for (let j = 0; j < size; j++) {
      const my = Math.PI * (1 - (2 * (y + (j + 0.5) / size)) / n2)
      const lat = Math.atan(Math.sinh(my)) / D
      for (let i = 0; i < size; i++) {
        const lon = ((x + (i + 0.5) / size) / n2) * 360 - 180
        const v = sample(lon, lat) * EARTH_OVER_MARS + 32768
        const k = (j * size + i) * 4
        img.data[k] = Math.floor(v / 256)
        img.data[k + 1] = Math.floor(v) % 256
        img.data[k + 2] = Math.floor((v - Math.floor(v)) * 256)
        img.data[k + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    const blob = await c.convertToBlob({ type: 'image/png' })
    return { data: await blob.arrayBuffer() }
  })
}
