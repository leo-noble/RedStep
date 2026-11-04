import { marsTime } from './mars24.js'

// Mean sunlight above the air at Mars's mean distance from the Sun (NASA NSSDC Mars fact sheet).
export const MARS_MEAN_IRRADIANCE = 586.2 // W/m²
const MARS_SEMI_MAJOR_AU = 1.52366231
const MARS_YEAR_MS = 686.98 * 8.64e7

/** Daily-mean sunlight on flat ground above the atmosphere (W/m²) at latitude `lat`, for the
 *  Sun's declination `dec` (degrees) and Mars–Sun distance `rAU`. Standard daily-insolation
 *  formula; dust and air are left out, so real ground light is lower. */
export function dailyMean(lat, dec, rAU) {
  const d2r = Math.PI / 180
  const phi = lat * d2r
  const del = dec * d2r
  const S = MARS_MEAN_IRRADIANCE * (MARS_SEMI_MAJOR_AU / rAU) ** 2
  const x = -Math.tan(phi) * Math.tan(del)
  const h0 = x >= 1 ? 0 : x <= -1 ? Math.PI : Math.acos(x) // polar night / midnight sun
  return (S / Math.PI) * (h0 * Math.sin(phi) * Math.sin(del) + Math.cos(phi) * Math.cos(del) * Math.sin(h0))
}

/** Sunlight over one Mars year at a latitude: the yearly mean and the darkest and brightest
 *  daily means, from the Mars24 orbit (declination and distance) sampled every few sols. */
export function yearOfSun(lat, startMs = Date.UTC(2026, 0, 1), samples = 120) {
  let sum = 0, min = Infinity, max = -Infinity
  for (let k = 0; k < samples; k++) {
    const t = marsTime(startMs + (MARS_YEAR_MS * k) / samples)
    const q = dailyMean(lat, t.dec, t.rAU)
    sum += q
    if (q < min) min = q
    if (q > max) max = q
  }
  return { mean: sum / samples, min, max }
}
