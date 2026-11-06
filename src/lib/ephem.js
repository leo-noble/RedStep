// Earth-Mars distance and one-way light time.
// Mars: heliocentric longitude, latitude and distance from Mars24 (D-2..D-4).
// Earth: low-precision solar coordinates (Meeus, Astronomical Algorithms, ch. 25), accurate to
// ~0.01 deg, far better than needed for a light-time figure.
import { marsTime } from './mars24.js'

const D = Math.PI / 180
const C_KM_S = 299792.458
const AU_KM = 149597870.7

function earthHelio(jdTT) {
  const T = (jdTT - 2451545.0) / 36525
  const L0 = 280.46646 + 36000.76983 * T
  const M = 357.52911 + 35999.05029 * T
  const C = (1.914602 - 0.004817 * T) * Math.sin(M * D) + 0.019993 * Math.sin(2 * M * D) + 0.000289 * Math.sin(3 * M * D)
  const e = 0.016708634 - 0.000042037 * T
  const nu = M + C
  const r = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu * D))
  return { lon: L0 + C + 180, lat: 0, r } // the Sun's geocentric longitude + 180 = Earth's heliocentric
}

const xyz = (lon, lat, r) => [r * Math.cos(lat * D) * Math.cos(lon * D), r * Math.cos(lat * D) * Math.sin(lon * D), r * Math.sin(lat * D)]

export function earthMars(ms) {
  const m = marsTime(ms)
  const e = earthHelio(m.jdTT)
  const a = xyz(m.helioLon, m.helioLat, m.rAU), b = xyz(e.lon, e.lat, e.r)
  const au = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const lightMin = (au * AU_KM) / C_KM_S / 60
  // Sun-Earth-Mars angle: below ~3 deg the Sun blocks radio links (solar conjunction).
  const se = Math.acos(-(b[0] * (a[0] - b[0]) + b[1] * (a[1] - b[1]) + b[2] * (a[2] - b[2])) / (e.r * au)) / D
  // Earth-Sun-Mars angle: how far apart the two planets are around the Sun (0 = same side).
  const apart = Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (m.rAU * e.r)) / D
  return { au, km: au * AU_KM, lightMin, sunAngle: se, marsSunAU: m.rAU, apart }
}
