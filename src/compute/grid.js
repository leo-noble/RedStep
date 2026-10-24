// A regular lon/lat grid of ground heights, plus the slope and ground-type grids derived from it.
// Pure functions, shared by the worker and the tests.

const DEG = Math.PI / 180

/**
 * @param {object} meta   the site's grid description (src/data/schema.js TerrainGrid)
 * @param {Int16Array} dm elevation in meta.unit (decimetres or metres), row 0 = north edge
 * @param {Uint8Array} [ground] THEMIS night IR brightness per cell (0 dark/cold .. 255 bright/warm)
 */
export function makeGrid(meta, dm, ground) {
  const { w, h, bbox, nodata, radius } = meta
  const [west, south, east, north] = bbox
  const dLon = (east - west) / w, dLat = (north - south) / h
  const midLat = (north + south) / 2
  const k = meta.unit === 'metres' ? 1 : 0.1
  const elev = new Float32Array(w * h)
  for (let i = 0; i < elev.length; i++) elev[i] = dm[i] === nodata ? NaN : dm[i] * k
  return {
    w, h, west, south, east, north, dLon, dLat, radius,
    dx: radius * Math.cos(midLat * DEG) * dLon * DEG, // metres per cell east-west
    dy: radius * dLat * DEG, // metres per cell north-south
    elev, ground: ground || null, slope: null,
  }
}

// Fractional cell coordinates (cell centres at integers).
export const toCell = (g, lon, lat) => [(lon - g.west) / g.dLon - 0.5, (g.north - lat) / g.dLat - 0.5]
export const toLonLat = (g, i, j) => [g.west + (i + 0.5) * g.dLon, g.north - (j + 0.5) * g.dLat]
export const inside = (g, lon, lat) => lon > g.west && lon < g.east && lat > g.south && lat < g.north

export function bilinear(g, arr, lon, lat) {
  const [fx, fy] = toCell(g, lon, lat)
  const x0 = Math.max(0, Math.min(g.w - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(g.h - 2, Math.floor(fy)))
  const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0))
  const a = arr[y0 * g.w + x0], b = arr[y0 * g.w + x0 + 1], c = arr[(y0 + 1) * g.w + x0], d = arr[(y0 + 1) * g.w + x0 + 1]
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
}

export const elevAt = (g, lon, lat) => bilinear(g, g.elev, lon, lat)
export const slopeAt = (g, lon, lat) => bilinear(g, g.slope, lon, lat)

/** Terrain slope in degrees per cell (Horn 1981, 3x3 window). */
export function computeSlope(g) {
  const { w, h, elev, dx, dy } = g
  const s = new Float32Array(w * h)
  const at = (i, j) => {
    const v = elev[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))]
    return Number.isNaN(v) ? elev[j * w + i] : v
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = at(i - 1, j - 1), b = at(i, j - 1), c = at(i + 1, j - 1)
      const d = at(i - 1, j), f = at(i + 1, j)
      const gg = at(i - 1, j + 1), hh = at(i, j + 1), ii = at(i + 1, j + 1)
      const dzdx = (c + 2 * f + ii - (a + 2 * d + gg)) / (8 * dx)
      const dzdy = (gg + 2 * hh + ii - (a + 2 * b + c)) / (8 * dy)
      const v = Math.atan(Math.hypot(dzdx, dzdy)) / DEG
      s[j * w + i] = Number.isFinite(v) ? v : 90
    }
  }
  g.slope = s
  return s
}

/** Great-circle distance in metres on the grid's sphere. */
export function distance(g, a, b) {
  const la1 = a[1] * DEG, la2 = b[1] * DEG, dl = (b[0] - a[0]) * DEG
  const x = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) ** 2
  return 2 * g.radius * Math.asin(Math.min(1, Math.sqrt(x)))
}
