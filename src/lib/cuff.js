// The wrist checklist: the walk as a short list of timed steps an astronaut can read at a glance,
// plus the hard rules. Built only from the planner's own analysis, so it agrees with the verdict.

const MARS_HOUR = 1.0274912517 // Earth hours in one Mars hour (a sol is 24 Mars hours)

/** Profile point (see analyze) nearest to a distance along the walk. */
const at = (profile, d) => profile.reduce((best, p) => (Math.abs(p[0] - d) < Math.abs(best[0] - d) ? p : best))

/**
 * @param a analysis from analyze()
 * @param stops the science stops on the walk (with name, minutes, bring)
 * @returns { steps: [{ t, what, note?, air?, key? }], rules: [string] }
 *   t is Mars local time in hours; air is the share of suit air used by then.
 */
export function cuffCard(a, { stops = [], settings: s }) {
  const t0 = a.sun.start.ltst
  const clock = (earthH) => t0 + earthH / MARS_HOUR
  const dH = a.drive?.hours || 0
  const where = a.drive ? 'rover' : 'habitat'
  const steps = []
  if (a.drive) steps.push({ t: clock(0), what: 'Leave the habitat in the rover', note: `${(a.drive.m / 1000).toFixed(1)} km drive` })
  steps.push({ t: clock(dH), what: a.drive ? 'Step out at the rover' : 'Leave the habitat', note: 'Suits full. Radio check with your buddy.', air: 0 })
  for (const v of a.visited) {
    const st = stops.find((x) => x.id === v.id)
    const p = at(a.profile, v.d)
    steps.push({ t: clock(dH + p[5] - v.minutes / 60), what: st?.name || 'Science stop', note: `${v.minutes} min${st?.bring ? ` · ${st.bring.toLowerCase()}` : ''}`, air: p[6], d: v.d })
  }
  if (!a.turnBack.atEnd) {
    const p = at(a.profile, a.turnBack.d)
    steps.push({ t: clock(dH + p[5]), what: `TURN BACK at ${(a.turnBack.d / 1000).toFixed(1)} km`, note: 'Whatever is left to see.', air: a.turnBack.airThere, key: true, d: a.turnBack.d })
  } else if (!a.loop) {
    steps.push({ t: clock(dH + a.outHours), what: 'Turn around at the far end', air: a.profile[a.profile.length - 1][6], d: a.distance })
  }
  steps.push({ t: clock(dH + a.hours), what: `Back at the ${where}`, note: `${Math.round(a.airLeft * 100)}% air left`, air: a.airUsed })
  if (a.drive) steps.push({ t: clock(2 * dH + a.hours), what: 'Back at the habitat' })
  steps.sort((x, y) => x.t - y.t)

  const rules = [
    a.turnBack.atEnd
      ? `Planned: ${Math.round(a.turnBack.airThere * 100)}% air used at the turn. If your suit reads more on the way out, head back early.`
      : `Turn back when suit air used reaches ${Math.round(a.turnBack.airThere * 100)}%, wherever you are.`,
    `Stay within ${s.walkBack} km of the ${where}.`,
    `No ground steeper than ${s.redSlope}°. Go around.`,
  ]
  if ((s.crew || 1) >= 2) rules.push('Never split up. Keep your buddy in sight.')
  return { steps, rules }
}
