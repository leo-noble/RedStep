// Bakes a "rocky ground" grid for walk planning from the HiRISE photo mosaic.
//
//   node scripts/bake-roughness.mjs [site]      (default: jezero)
//
// HiRISE sees boulders as small bright rocks with dark shadows, so rocky ground has strong
// contrast at the scale of a few pixels while smooth plains and dust do not. For every cell of
// the planning grid (the same grid as elevation.i16) we measure that fine-scale contrast: the
// mean absolute difference between each pixel and a 5x5 blur of it. The result is scaled to
// 0..255 over the area HiRISE covers and written to public/data/<site>/rough.u8. Cells outside
// the HiRISE footprint are 0 (no information, so no penalty). This is a texture measure, not a
// boulder count: sand ripples also have contrast, which is why the planner only adds cost, it
// never forbids ground on this basis.
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const site = process.argv[2] || 'jezero'
const DIR = path.join(ROOT, 'public', 'data', site)
const DEG = Math.PI / 180
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))

const meta = JSON.parse(await fs.readFile(path.join(DIR, 'meta.json'), 'utf8'))
const H = meta.layers?.hirise
if (!H) throw new Error(`${site} has no HiRISE layer`)
const { data, info } = await sharp(path.join(DIR, H.file)).greyscale().raw().toBuffer({ resolveWithObject: true })
const W = info.width, Hpx = info.height
const blur = await sharp(path.join(DIR, H.file)).greyscale().blur(1.6).raw().toBuffer()
const [w0, s0, e0, n0] = H.bbox
const yN = mercY(n0), yS = mercY(s0)
const px = (lon) => ((lon - w0) / (e0 - w0)) * W
const py = (lat) => ((yN - mercY(lat)) / (yN - yS)) * Hpx

const g = meta.grid
const [gw, gs, ge, gn] = g.bbox
const dLon = (ge - gw) / g.w, dLat = (gn - gs) / g.h
const raw = new Float32Array(g.w * g.h).fill(-1)
for (let j = 0; j < g.h; j++) {
  const latTop = gn - j * dLat, latBot = latTop - dLat
  if (latBot < s0 || latTop > n0) continue
  const y0 = Math.max(0, Math.floor(py(latTop))), y1 = Math.min(Hpx, Math.ceil(py(latBot)))
  for (let i = 0; i < g.w; i++) {
    const lonL = gw + i * dLon, lonR = lonL + dLon
    if (lonL < w0 || lonR > e0) continue
    const x0 = Math.max(0, Math.floor(px(lonL))), x1 = Math.min(W, Math.ceil(px(lonR)))
    let sum = 0, n = 0, dark = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = y * W + x
        if (data[k] < 4) { dark++; continue } // mosaic padding / no-data
        sum += Math.abs(data[k] - blur[k])
        n++
      }
    }
    if (n > 0.6 * (n + dark)) raw[j * g.w + i] = sum / n
  }
}

const vals = Array.from(raw).filter((v) => v >= 0).sort((a, b) => a - b)
if (!vals.length) throw new Error('HiRISE footprint does not overlap the grid')
const lo = vals[Math.floor(vals.length * 0.05)], hi = vals[Math.floor(vals.length * 0.99)]
const out = new Uint8Array(g.w * g.h)
for (let k = 0; k < out.length; k++) out[k] = raw[k] < 0 ? 0 : Math.round(255 * Math.min(1, Math.max(0, (raw[k] - lo) / (hi - lo))))
await fs.writeFile(path.join(DIR, 'rough.u8'), out)
meta.rough = 'rough.u8'
await fs.writeFile(path.join(DIR, 'meta.json'), JSON.stringify(meta, null, 1))
console.log(`rough.u8: ${vals.length} cells with HiRISE cover of ${out.length}; contrast p5 ${lo.toFixed(2)}, p99 ${hi.toFixed(2)}`)
