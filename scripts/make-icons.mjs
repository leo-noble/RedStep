// Builds every app icon from assets/logo-mark.svg (the Redstep mark: an astronaut's helmet with
// Mars reflected in the visor).
//   node scripts/make-icons.mjs
// - favicon.svg and icons/icon-{192,512}.png: rounded dark tile, helmet about 74% wide
// - icons/apple-touch-icon.png (180): full square, iOS rounds the corners itself
// - icons/maskable-512.png: full bleed, mark inside Android's 80% safe circle
// - icons/favicon-32.png for browsers without SVG favicons
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mark = (await fs.readFile(path.join(ROOT, 'assets/logo-mark.svg'), 'utf8')).replace(/<!--[\s\S]*?-->/g, '')
const OUT = path.join(ROOT, 'public/icons')

const tile = ({ rounded, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="rs-bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#241410"/>
      <stop offset="1" stop-color="#07060a"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" ${rounded ? 'rx="228"' : ''} fill="url(#rs-bg)"/>
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${mark}</g>
</svg>`

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, file))

await fs.mkdir(OUT, { recursive: true })
const rounded = tile({ rounded: true, scale: 1.2 })
const square = tile({ rounded: false, scale: 1.2 })
const maskable = tile({ rounded: false, scale: 0.98 })
await fs.writeFile(path.join(ROOT, 'public/favicon.svg'), rounded)
await png(rounded, 192, 'icon-192.png')
await png(rounded, 512, 'icon-512.png')
await png(square, 180, 'apple-touch-icon.png')
await png(maskable, 512, 'maskable-512.png')
await png(rounded, 32, 'favicon-32.png')
// the bare mark, for the nav bar and the share card
await fs.writeFile(path.join(OUT, 'mark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="180 176 664 664">${mark}</svg>`)
console.log('icons written to public/icons')
