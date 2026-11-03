import { instantAtLocalTime, sunAt } from './mars24.js'

/**
 * Which departure times keep the sun above `minSun` for a whole walk of `hours` (Earth hours),
 * on the sol that contains `dateMs`, at a site (lat, lon east). Start times are Mars local true
 * solar time, sampled every `step` hours between `from` and `to` (the planner's own limits).
 *
 * Returns null when no start works, otherwise
 *   { earliest, latest }   the first and last start hours that work
 *   { best, bestMin }      the start whose lowest sun is highest (light centred on noon)
 * Built only from the Mars24 sun model the planner already uses, so it agrees with the verdict.
 */
export function startWindow({ dateMs, lat, lon, hours, minSun, from = 5, to = 17, step = 0.25 }) {
  if (!(hours > 0)) return null
  const durMs = hours * 3.6e6
  const samples = Math.max(4, Math.ceil(hours * 6)) // every ten minutes or closer
  let earliest = null, latest = null, best = null, bestMin = -Infinity
  for (let h = from; h <= to + 1e-9; h += step) {
    const t0 = instantAtLocalTime(dateMs, lon, h)
    let low = Infinity
    for (let k = 0; k <= samples; k++) {
      const e = sunAt(t0 + (durMs * k) / samples, lat, lon).elevation
      if (e < low) low = e
      if (low < minSun) break
    }
    if (low < minSun) continue
    if (earliest === null) earliest = h
    latest = h
    if (low > bestMin) { bestMin = low; best = h }
  }
  return earliest === null ? null : { earliest, latest, best, bestMin }
}
