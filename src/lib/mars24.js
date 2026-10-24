// Mars24 sunclock algorithm, NASA GISS (Allison & McEwen 2000, Planet. Space Sci. 48, 215).
// https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
// Equation numbers below match that page. Longitudes in this app are degrees EAST; the
// algorithm uses degrees WEST, so we convert at the edges.

const D = Math.PI / 180
const sin = (d) => Math.sin(d * D)
const cos = (d) => Math.cos(d * D)
const mod = (x, m) => ((x % m) + m) % m

// TAI-UTC leap seconds since 2000 (IERS Bulletin C). TT-UTC = TAI-UTC + 32.184 s.
const LEAPS = [
  [Date.UTC(2017, 0, 1), 37], [Date.UTC(2015, 6, 1), 36], [Date.UTC(2012, 6, 1), 35],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2006, 0, 1), 33], [-Infinity, 32],
]
const ttMinusUtc = (ms) => LEAPS.find(([t]) => ms >= t)[1] + 32.184

const PBS = [
  [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.002, 2.4694, 95.528], [0.0018, 32.8493, 49.095],
]

/** Planet-wide quantities for an instant (ms since Unix epoch, UTC). */
export function marsTime(ms) {
  const jdUT = 2440587.5 + ms / 8.64e7 // A-2
  const jdTT = jdUT + ttMinusUtc(ms) / 86400 // A-5
  const dt = jdTT - 2451545.0 // A-6
  const M = mod(19.3871 + 0.52402073 * dt, 360) // B-1
  const aFMS = mod(270.3871 + 0.524038496 * dt, 360) // B-2
  const pbs = PBS.reduce((s, [A, tau, phi]) => s + A * cos((0.985626 * dt) / tau + phi), 0) // B-3
  const nuM = (10.691 + 3.0e-7 * dt) * sin(M) + 0.623 * sin(2 * M) + 0.05 * sin(3 * M) + 0.005 * sin(4 * M) + 0.0005 * sin(5 * M) + pbs // B-4
  const Ls = mod(aFMS + nuM, 360) // B-5
  const eot = 2.861 * sin(2 * Ls) - 0.071 * sin(4 * Ls) + 0.002 * sin(6 * Ls) - nuM // C-1, degrees
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626 // Mars Sol Date
  const mst = mod(24 * msd, 24) // C-2, hours
  const subLonW = mod(mst * 15 + eot + 180, 360) // C-5
  const dec = Math.asin(0.42565 * sin(Ls)) / D + 0.25 * sin(Ls) // D-1
  const rAU = 1.52367934 * (1.00436 - 0.09309 * cos(M) - 0.004336 * cos(2 * M) - 0.00031 * cos(3 * M) - 0.00003 * cos(4 * M)) // D-2
  const helioLon = mod(Ls + 85.061 - 0.015 * sin(71 + 2 * Ls) - 5.5e-6 * dt, 360) // D-3
  const helioLat = -(1.8497 - 2.23e-5 * dt) * sin(Ls - 144.5 + 2.57e-6 * dt) // D-4
  return { jdUT, jdTT, dt, M, Ls, eot, msd, mst, sol: Math.floor(msd), subLonE: mod(-subLonW, 360), subLonW, dec, rAU, helioLon, helioLat }
}

/** Local solar quantities at a site (lat planetographic deg, lon degrees EAST). */
export function sunAt(ms, lat, lonE, t = marsTime(ms)) {
  const lonW = mod(-lonE, 360)
  const lmst = mod(t.mst - lonW / 15, 24) // C-3
  const ltst = mod(lmst + t.eot / 15, 24) // C-4
  const H = lonW - t.subLonW // D-5
  const cz = sin(t.dec) * sin(lat) + cos(t.dec) * cos(lat) * cos(H)
  const Z = Math.acos(Math.max(-1, Math.min(1, cz))) / D
  const az = mod(Math.atan2(sin(H), cos(lat) * Math.tan(t.dec * D) - sin(lat) * cos(H)) / D, 360) // D-6
  return { lmst, ltst, zenith: Z, elevation: 90 - Z, azimuth: az }
}

export const SOL_MS = 88775244.147 // one mean solar day on Mars, ms (1.0274912517 Earth days)

/** ms instant when local true solar time at lonE reaches `hour`, on the Mars sol containing ms. */
export function instantAtLocalTime(ms, lonE, hour) {
  let t = ms
  for (let i = 0; i < 4; i++) {
    const { ltst } = sunAt(t, 0, lonE)
    let d = hour - ltst
    if (d > 12) d -= 24
    if (d < -12) d += 24
    t += (d / 24) * SOL_MS
  }
  return t
}

/** Sunrise / sunset (sun centre crossing the horizon) for the sol containing ms, as LTST hours. */
export function daylight(ms, lat, lonE) {
  const noon = instantAtLocalTime(ms, lonE, 12)
  const find = (from, to) => {
    let a = from, b = to
    const ea = sunAt(a, lat, lonE).elevation
    if (Math.sign(ea) === Math.sign(sunAt(b, lat, lonE).elevation)) return null
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2
      if (Math.sign(sunAt(m, lat, lonE).elevation) === Math.sign(ea)) a = m
      else b = m
    }
    return (a + b) / 2
  }
  const rise = find(noon - SOL_MS / 2, noon)
  const set = find(noon, noon + SOL_MS / 2)
  return { noon, rise, set }
}

export const fmtHours = (h) => {
  const m = Math.round(mod(h, 24) * 60)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
