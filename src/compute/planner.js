// Route building on top of the grid: drawn routes (straight or snapped to safe paths) and the
// "Suggest safe route" search that picks science stops to fit the suit's air and the daylight.
import { computeSlope, distance, toLonLat } from './grid.js'
import { astar, cellCosts, cellOf, cellsToLine, dijkstra, nearestWalkable, walkBack } from './pathfind.js'
import { airPerHour, analyze, crewOf, pace } from './walk.js'
import { sunAt } from '../lib/mars24.js'

export function createPlanner(g) {
  if (!g.slope) computeSlope(g)
  let costKey = '', costs = null
  const trees = new Map() // node key -> dijkstra result, for the current costs

  function costsFor(s) {
    const key = `${s.greenSlope}|${s.redSlope}`
    if (key !== costKey) { costKey = key; costs = cellCosts(g, s); trees.clear() }
    return costs
  }

  const cell = (c, p) => nearestWalkable(g, c, cellOf(g, p[0], p[1]))

  /** Build a line through waypoints. snap[k] says whether segment k follows a safe path. */
  function buildLine(waypoints, snap, s) {
    const c = costsFor(s)
    const line = [waypoints[0]]
    const segments = []
    for (let k = 0; k < waypoints.length - 1; k++) {
      const a = waypoints[k], b = waypoints[k + 1]
      if (snap[k]) {
        const ca = cell(c, a), cb = cell(c, b)
        const path = ca >= 0 && cb >= 0 ? astar(g, c, ca, cb) : null
        if (path) {
          const pts = cellsToLine(g, path)
          line.push(...pts.slice(1, -1), b)
          segments.push({ snapped: true, ok: true })
          continue
        }
        segments.push({ snapped: true, ok: false }) // no safe path: fall back to the straight line
      } else segments.push({ snapped: false, ok: true })
      line.push(b)
    }
    return { line, segments }
  }

  /** Rover drop-off: the drive from the habitat (base) to where the walk starts, on a safe path. */
  function driveTo(base, start, s) {
    if (!base || distance(g, base, start) < 30) return null
    const { line } = buildLine([base, start], [true], s)
    let m = 0
    for (let k = 1; k < line.length; k++) m += distance(g, line[k - 1], line[k])
    return { m, straight: distance(g, base, start), line }
  }
  const driveInfo = (d) => d && { m: d.m, straight: d.straight }

  function plan({ waypoints, snap, stops, settings, startMs, site, habitat, base, facts }) {
    const { line, segments } = buildLine(waypoints, snap, settings)
    const drive = driveTo(base, habitat, settings)
    const analysis = analyze(g, { line, stops, settings, startMs, site, habitat, facts, drive: driveInfo(drive), base })
    return { line, segments, analysis, driveLine: drive?.line || null }
  }

  /** Air and hours to walk a cell path forward and backward (same model as analyze). */
  function legCost(cells, s) {
    let fAir = 0, bAir = 0, fH = 0, bH = 0
    for (let k = 1; k < cells.length; k++) {
      const u = cells[k - 1], v = cells[k]
      const ds = Math.hypot(((v % g.w) - (u % g.w)) * g.dx, (((v / g.w) | 0) - ((u / g.w) | 0)) * g.dy)
      const grade = (g.elev[v] - g.elev[u]) / ds
      const tf = ds / 1000 / pace(s.flatPace, grade), tb = ds / 1000 / pace(s.flatPace, -grade)
      fH += tf; bH += tb
      fAir += airPerHour(s, grade) * tf; bAir += airPerHour(s, -grade) * tb
    }
    return { fAir, bAir, fH, bH }
  }

  /**
   * Choose science stops greedily by value per unit of air, chaining outward from the habitat and
   * walking home the same way. appetite (0..1] = share of the usable air budget we allow.
   */
  function suggest({ habitat, base, stops, settings: s, startMs, site, facts, appetite = 0.85 }) {
    const drive = driveTo(base, habitat, s)
    const driveH = drive ? drive.m / 1000 / Math.max(0.5, s.roverSpeed || 6) : 0
    // Air is costed for the suit that breathes hardest (the one carrying most), as analyze does.
    const sl = { ...s, load: Math.max(...crewOf(s).map((c) => c.load)) }
    const c = costsFor(s)
    const nodes = [{ id: 'habitat', lon: habitat[0], lat: habitat[1], value: 0, minutes: 0 }, ...stops]
      .map((p) => ({ ...p, cell: cell(c, [p.lon, p.lat]) }))
      .filter((p) => p.cell >= 0)
    const inRadius = (p) => distance(g, habitat, [p.lon, p.lat]) <= s.walkBack * 1000
    const cand = nodes.slice(1).filter(inRadius)

    // Daylight available from departure until the sun drops below the minimum, less the rover
    // drive out and back.
    let maxHours = 0
    for (let h = 0; h < 14; h += 0.1) {
      if (sunAt(startMs + h * 3.6e6, site.lat, site.lon).elevation < s.minSun) break
      maxHours = h
    }
    maxHours = Math.max(0, maxHours - 2 * driveH)

    const targets = nodes.map((p) => p.cell)
    const tree = (p) => {
      if (!trees.has(p.cell)) trees.set(p.cell, dijkstra(g, c, p.cell, targets))
      return trees.get(p.cell)
    }
    const legs = new Map()
    const leg = (a, b) => {
      const k = `${a.cell}>${b.cell}`
      if (!legs.has(k)) {
        const t = tree(a)
        if (t.dist[b.cell] === Infinity) legs.set(k, null)
        else { const cells = walkBack(t.prev, b.cell); legs.set(k, { cells, ...legCost(cells, sl) }) }
      }
      return legs.get(k)
    }

    // Try every set of candidate stops (at most 2^9 = 512), visiting each set in nearest-next
    // order and walking home the same way. Keep the set with the most science value that fits
    // the air budget and the daylight; on a tie, the one that uses less air.
    const budget = (1 - s.reserve / 100) * appetite
    const cost = (order) => {
      let air = 0, h = 0
      for (let k = 1; k < order.length; k++) {
        const L = leg(order[k - 1], order[k])
        if (!L) return null
        const stopH = (order[k].minutes ?? s.stopMinutes) / 60
        air += L.fAir + L.bAir + stopH / s.suitHours
        h += L.fH + L.bH + stopH
      }
      return { air, h }
    }
    const nearestOrder = (set) => {
      const order = [nodes[0]], left = new Set(set)
      while (left.size) {
        const last = order[order.length - 1]
        let best = null, bd = Infinity
        for (const p of left) { const d = distance(g, [last.lon, last.lat], [p.lon, p.lat]); if (d < bd) { bd = d; best = p } }
        order.push(best); left.delete(best)
      }
      return order
    }
    let chain = [nodes[0]], bestValue = 0, bestAir = Infinity
    for (let mask = 1; mask < 1 << cand.length; mask++) {
      const set = cand.filter((_, k) => mask & (1 << k))
      const value = set.reduce((v, p) => v + (p.value || 1), 0)
      if (value < bestValue) continue
      const order = nearestOrder(set)
      const c2 = cost(order)
      if (!c2 || c2.air > budget || c2.h > maxHours) continue
      if (value > bestValue || c2.air < bestAir) { chain = order; bestValue = value; bestAir = c2.air }
    }

    if (chain.length === 1) return { line: null, chosen: [], waypoints: [habitat], maxHours }
    const cells = [chain[0].cell]
    for (let k = 1; k < chain.length; k++) cells.push(...leg(chain[k - 1], chain[k]).cells.slice(1))
    const line = cellsToLine(g, cells)
    line[0] = habitat
    const chosen = chain.slice(1)
    const analysis = analyze(g, { line, stops: chosen, settings: s, startMs, site, habitat, facts, drive: driveInfo(drive), base })
    return {
      line, analysis, maxHours, driveLine: drive?.line || null,
      chosen: chosen.map((p) => p.id),
      waypoints: [habitat, ...chosen.map((p) => [p.lon, p.lat])],
    }
  }

  /**
   * A deliberately risky walk, chosen from the terrain itself: the nearest science stop whose
   * straight line from the habitat crosses ground steeper than the limit. If no stop does, scan
   * straight lines in 36 directions (1-6 km) for the shortest one that does. Last resort: the
   * farthest stop in a straight line, which breaks the air budget.
   */
  function risky({ habitat, stops, settings: s, startMs, site, facts }) {
    const tryLine = (to, stop) => {
      const line = [habitat, to]
      const analysis = analyze(g, { line, stops: stop ? [stop] : [], settings: s, startMs, site, habitat, facts })
      return { line, analysis, stop }
    }
    const byDist = [...stops].sort((a, b) => distance(g, habitat, [a.lon, a.lat]) - distance(g, habitat, [b.lon, b.lat]))
    for (const st of byDist) {
      const r = tryLine([st.lon, st.lat], st)
      if (r.analysis.reasons.some((x) => x.code === 'steep')) return { ...r, why: 'steep' }
    }
    const R = g.radius, D = Math.PI / 180
    for (let km = 1; km <= 6; km += 0.5) {
      for (let b = 0; b < 360; b += 10) {
        const ang = (km * 1000) / R, la = habitat[1] * D, lo = habitat[0] * D, br = b * D
        const la2 = Math.asin(Math.sin(la) * Math.cos(ang) + Math.cos(la) * Math.sin(ang) * Math.cos(br))
        const lo2 = lo + Math.atan2(Math.sin(br) * Math.sin(ang) * Math.cos(la), Math.cos(ang) - Math.sin(la) * Math.sin(la2))
        const to = [lo2 / D, la2 / D]
        if (to[0] <= g.west || to[0] >= g.east || to[1] <= g.south || to[1] >= g.north) continue
        const r = tryLine(to, null)
        if (r.analysis.reasons.some((x) => x.code === 'steep')) return { ...r, why: 'steep' }
      }
    }
    const far = byDist[byDist.length - 1]
    return { ...tryLine([far.lon, far.lat], far), why: 'far' }
  }

  return { plan, suggest, risky, costsFor, toLonLat: (i, j) => toLonLat(g, i, j) }
}
