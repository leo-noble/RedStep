// Mission advisor: a deterministic local rule engine. It is NOT an AI model.
// Each rule reads the walk analysis and returns one plain-language tip with the rule that fired,
// so anyone can check why it said what it said.
import { fmtH, pct } from '../compute/walk.js'
import { fmtHours, sunAt } from './mars24.js'

export const ADVISOR_LABEL = 'Local rule engine — not a live AI model'

export function advise(a, { settings: s, stops, startMs, site, visitedIds = [], snap = false }) {
  if (!a) return []
  const tips = []
  const km = (m) => `${(m / 1000).toFixed(1)} km`

  // 1. Steep ground
  if (a.reasons.some((r) => r.code === 'steep') && !snap) {
    tips.push({ id: 'steep', text: `Switch on "Follow safe paths". The planner will route around the ${a.maxSlope.toFixed(0)}° slope at ${km(a.maxSlopeAt[2])}.`, rule: `max slope ${a.maxSlope.toFixed(1)}° > limit ${s.redSlope}°`, action: 'snap' })
  }

  // 2. Not enough air: say how far you can get
  if (a.airUsed > a.budget) {
    tips.push({ id: 'air', text: `Turn back at ${km(a.turnBack.d)} out, or remove the farthest stop. With a ${s.reserve}% reserve you can only use ${pct(a.budget)} of the suit's air.`, rule: `air needed ${pct(a.airUsed)} > usable ${pct(a.budget)}` })
  }

  // 3. Daylight: how much earlier to leave
  const lowAt = a.sun.darkAt ?? a.sun.lowAt
  if (lowAt !== null) {
    const short = a.hours - lowAt
    const earlier = Math.ceil((short * 60 + 15) / 15) * 15
    const newStart = s.startHour - earlier / 60
    const ok = newStart >= 5 && sunAt(startMs - earlier * 60000, site.lat, site.lon).elevation >= s.minSun
    tips.push({
      id: 'sun',
      text: ok
        ? `Leave ${earlier} min earlier (at ${fmtHours(newStart)} Mars time) to be home before the sun drops below ${s.minSun}°.`
        : `This walk is longer than the daylight. Split it over two sols or remove a stop.`,
      rule: `sun below ${s.minSun}° after ${fmtH(lowAt)}; walk lasts ${fmtH(a.hours)}`,
    })
  }

  // 4. Walk-back circle
  if (a.farthest > s.walkBack * 1000) {
    tips.push({ id: 'radius', text: `You go ${km(a.farthest)} from the habitat. Take the pressurised rover, or keep the walk inside ${s.walkBack} km.`, rule: `farthest point ${km(a.farthest)} > circle ${s.walkBack} km` })
  }

  // 5. Spare air: suggest one more stop that fits
  if (a.status !== 'nogo' && a.airLeft - (1 - a.budget) > 0.12) {
    const spare = a.airLeft - (1 - a.budget)
    const extra = stops.filter((p) => !visitedIds.includes(p.id)).map((p) => {
      let best = Infinity
      for (const q of a.profile) {
        const d = Math.hypot((q[3] - p.lon) * 56000, (q[4] - p.lat) * 59300)
        if (d < best) best = d
      }
      return { p, d: best }
    }).filter((x) => x.d < 1500).sort((x, y) => y.p.value - x.p.value || x.d - y.d)[0]
    if (extra) tips.push({ id: 'extra', text: `You have about ${pct(spare)} spare air. ${extra.p.name} is ${km(extra.d)} off your route — worth adding?`, rule: `spare air ${pct(spare)} > 12%, stop within 1.5 km`, stop: extra.p.id })
  }

  // 6. Radiation in context
  tips.push({ id: 'dose', text: `This walk adds about ${a.dose.toFixed(2)} mSv, about ${Math.max(1, Math.round(a.dose / 0.1))} chest X-ray${a.dose / 0.1 >= 1.5 ? 's' : ''}. Most of a Mars trip's dose comes from the flight, not from walks.`, rule: `${fmtH(a.hours)} × 0.64 mSv/day (Curiosity RAD)` })

  // 7. Earth is far away
  tips.push({ id: 'comms', text: `A message to Earth takes ${a.comms.lightMin.toFixed(0)} min one way. Agree your turn-back point with the habitat before you leave — Earth cannot help in real time.`, rule: `one-way light time ${a.comms.lightMin.toFixed(1)} min` })

  return tips.slice(0, 5)
}
