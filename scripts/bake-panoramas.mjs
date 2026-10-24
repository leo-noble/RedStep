// Download the rover panoramas listed in src/content/panoramas.js from NASA and shrink them for
// the web (public/data/panoramas/<id>.webp). Originals are kept in data-raw/panoramas/.
//   node scripts/bake-panoramas.mjs
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PANORAMAS } from '../src/content/panoramas.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data-raw/panoramas')
const OUT = path.join(ROOT, 'public/data/panoramas')
const WIDTH = 6000 // wide enough to zoom in a little; about 1-2 MB each

await fs.mkdir(RAW, { recursive: true })
await fs.mkdir(OUT, { recursive: true })
for (const p of PANORAMAS) {
  const raw = path.join(RAW, `${p.pia}.jpg`)
  try { await fs.access(raw) } catch {
    console.log(`download ${p.pia}`)
    const res = await fetch(p.image)
    if (!res.ok) throw new Error(`${res.status} ${p.image}`)
    if (!(res.headers.get('content-type') || '').startsWith('image/')) throw new Error(`not an image: ${p.image}`)
    await fs.writeFile(raw, Buffer.from(await res.arrayBuffer()))
  }
  const img = sharp(raw, { limitInputPixels: false })
  const { width, height } = await img.metadata()
  const out = path.join(OUT, p.file)
  const info = await img.resize({ width: Math.min(WIDTH, width) }).webp({ quality: 80 }).toFile(out)
  console.log(`${p.id}: ${width}x${height} -> ${info.width}x${info.height}, ${(info.size / 1e6).toFixed(2)} MB`)
}
