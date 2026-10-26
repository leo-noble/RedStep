// Half-size copies of a site's big photos (the CTX photo and HiRISE, 4096 px wide) for
// low-memory devices: each decodes to about a quarter of the memory. Written next to the
// originals as <name>-2k.webp and listed in meta.json as `lite`; the app picks them on
// weak devices (see src/data/adapters/baked.js). Rover panoramas get the same treatment.
// Run: node scripts/make-lite.mjs [site]
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const MAX = 2048

export async function makeLite(dir) {
  const metaPath = path.join(dir, 'meta.json')
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))
  const entries = [meta.photo, ...Object.values(meta.layers || {})].filter(Boolean)
  for (const L of entries) {
    const src = path.join(dir, L.file)
    const { width = 0, height = 0 } = await sharp(src).metadata()
    if (Math.max(width, height) <= MAX) { delete L.lite; continue }
    const lite = L.file.replace(/\.webp$/, '-2k.webp')
    await sharp(src).resize({ width: MAX, height: MAX, fit: 'inside' }).webp({ quality: 80, effort: 5 }).toFile(path.join(dir, lite))
    L.lite = lite
    console.log(`  ${L.file} ${width}×${height} → ${lite}`)
  }
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 1))
}

/** Rover panoramas (6000 px wide) get a 3000 px <name>-3k.webp copy for the same devices. */
export async function makePanoramaLite(dir) {
  for (const f of await fs.readdir(dir)) {
    if (!/\.webp$/.test(f) || /-3k\.webp$/.test(f)) continue
    const src = path.join(dir, f)
    const { width = 0 } = await sharp(src).metadata()
    if (width <= 3000) continue
    const lite = f.replace(/\.webp$/, '-3k.webp')
    await sharp(src).resize({ width: 3000 }).webp({ quality: 80, effort: 5 }).toFile(path.join(dir, lite))
    console.log(`  ${f} ${width} px → ${lite}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = process.argv[2] || 'jezero'
  await makeLite(path.resolve('public/data', site))
  await makePanoramaLite(path.resolve('public/data/panoramas'))
}
