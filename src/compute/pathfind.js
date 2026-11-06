// Least-cost walking paths over the slope grid (Dijkstra / A*, 8-connected).
// Cost of a step = metres walked x slope penalty x loose-ground penalty.
// Ground steeper than the red limit is not walkable at all.
import { toCell, toLonLat } from './grid.js'

class Heap {
  constructor(n = 1 << 16) { this.i = new Int32Array(n); this.k = new Float64Array(n); this.n = 0 }
  push(i, k) {
    if (this.n === this.i.length) {
      const ni = new Int32Array(this.n * 2), nk = new Float64Array(this.n * 2)
      ni.set(this.i); nk.set(this.k); this.i = ni; this.k = nk
    }
    let p = this.n++
    while (p > 0) {
      const q = (p - 1) >> 1
      if (this.k[q] <= k) break
      this.i[p] = this.i[q]; this.k[p] = this.k[q]; p = q
    }
    this.i[p] = i; this.k[p] = k
  }
  pop() {
    const top = this.i[0]
    const li = this.i[--this.n], lk = this.k[this.n]
    let p = 0
    for (;;) {
      let c = 2 * p + 1
      if (c >= this.n) break
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++
      if (this.k[c] >= lk) break
      this.i[p] = this.i[c]; this.k[p] = this.k[c]; p = c
    }
    this.i[p] = li; this.k[p] = lk
    return top
  }
}

/** Per-cell multiplier on walking cost; Infinity = impassable. */
export function cellCosts(g, { greenSlope, redSlope, looseGround = 0.6, rockyGround = 2 }) {
  const n = g.w * g.h
  const c = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    const s = g.slope[k]
    if (!(s <= redSlope) || Number.isNaN(g.elev[k])) { c[k] = Infinity; continue }
    // gentle ground costs ~1; cost climbs steeply through the amber band
    const over = Math.max(0, s - greenSlope) / Math.max(1, redSlope - greenSlope)
    let m = 1 + 0.02 * s + 3 * over * over
    // THEMIS night IR: dark (cold at night) = loose dust/sand, slower and tiring
    if (g.ground) m *= 1 + looseGround * Math.max(0, 0.5 - g.ground[k] / 255)
    // HiRISE texture: rocky-looking ground is slower and riskier, so routes bend around it
    if (g.rough) { const r = g.rough[k] / 255; m *= 1 + rockyGround * r * r }
    c[k] = m
  }
  return c
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

/**
 * Dijkstra from one cell until all `targets` are settled (or the whole grid).
 * Returns { dist, prev } over cell indices.
 */
export function dijkstra(g, costs, start, targets = []) {
  const n = g.w * g.h
  const dist = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const want = new Set(targets.filter((t) => t >= 0))
  const heap = new Heap()
  const len = STEPS.map(([a, b]) => Math.hypot(a * g.dx, b * g.dy))
  dist[start] = 0
  heap.push(start, 0)
  while (heap.n) {
    const u = heap.pop()
    if (done[u]) continue
    done[u] = 1
    if (want.delete(u) && want.size === 0 && targets.length) break
    const ux = u % g.w, uy = (u / g.w) | 0
    for (let s = 0; s < 8; s++) {
      const vx = ux + STEPS[s][0], vy = uy + STEPS[s][1]
      if (vx < 0 || vy < 0 || vx >= g.w || vy >= g.h) continue
      const v = vy * g.w + vx
      if (done[v]) continue
      const m = (costs[u] + costs[v]) / 2
      if (m === Infinity) continue
      // no corner cutting: a diagonal step needs both side cells walkable
      if (s > 3 && (costs[uy * g.w + vx] === Infinity || costs[vy * g.w + ux] === Infinity)) continue
      const d = dist[u] + len[s] * m
      if (d < dist[v]) { dist[v] = d; prev[v] = u; heap.push(v, d) }
    }
  }
  return { dist, prev }
}

/** A* between two cells. Returns the cell path (start..end) or null. */
export function astar(g, costs, start, goal) {
  const n = g.w * g.h
  const dist = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const heap = new Heap()
  const len = STEPS.map(([a, b]) => Math.hypot(a * g.dx, b * g.dy))
  const gx = goal % g.w, gy = (goal / g.w) | 0
  const h = (u) => Math.hypot(((u % g.w) - gx) * g.dx, (((u / g.w) | 0) - gy) * g.dy)
  dist[start] = 0
  heap.push(start, h(start))
  while (heap.n) {
    const u = heap.pop()
    if (done[u]) continue
    if (u === goal) break
    done[u] = 1
    const ux = u % g.w, uy = (u / g.w) | 0
    for (let s = 0; s < 8; s++) {
      const vx = ux + STEPS[s][0], vy = uy + STEPS[s][1]
      if (vx < 0 || vy < 0 || vx >= g.w || vy >= g.h) continue
      const v = vy * g.w + vx
      if (done[v]) continue
      const m = (costs[u] + costs[v]) / 2
      if (m === Infinity) continue
      // no corner cutting: a diagonal step needs both side cells walkable
      if (s > 3 && (costs[uy * g.w + vx] === Infinity || costs[vy * g.w + ux] === Infinity)) continue
      const d = dist[u] + len[s] * m
      if (d < dist[v]) { dist[v] = d; prev[v] = u; heap.push(v, d + h(v)) }
    }
  }
  if (dist[goal] === Infinity) return null
  return walkBack(prev, goal)
}

export function walkBack(prev, end) {
  const path = []
  for (let u = end; u !== -1; u = prev[u]) path.push(u)
  return path.reverse()
}

export function cellOf(g, lon, lat) {
  const [fx, fy] = toCell(g, lon, lat)
  const i = Math.round(fx), j = Math.round(fy)
  if (i < 0 || j < 0 || i >= g.w || j >= g.h) return -1
  return j * g.w + i
}

/** Nearest walkable cell within r cells (habitat or a stop may sit on a rough pixel). */
export function nearestWalkable(g, costs, cell, r = 6) {
  if (cell < 0) return -1
  if (costs[cell] !== Infinity) return cell
  const cx = cell % g.w, cy = (cell / g.w) | 0
  let best = -1, bd = Infinity
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue
    const k = y * g.w + x
    if (costs[k] !== Infinity && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = k }
  }
  return best
}

/** Cell path to lon/lat, dropping points that sit on a straight run (keeps shape, ~5x fewer points). */
export function cellsToLine(g, cells) {
  const pts = cells.map((c) => toLonLat(g, c % g.w, (c / g.w) | 0))
  if (pts.length < 3) return pts
  const out = [pts[0]]
  for (let k = 1; k < pts.length - 1; k++) {
    const a = out[out.length - 1], b = pts[k], c = pts[k + 1]
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if (Math.abs(cross) > 1e-12) out.push(b)
  }
  out.push(pts[pts.length - 1])
  return out
}
