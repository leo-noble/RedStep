// Builds public/og.png (1200x630 share card) from the baked Jezero HiRISE close-up.
//   node scripts/make-og.mjs   (run after npm run bake)
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = 1200, H = 630
const photo = await sharp(path.join(ROOT, 'public/data/jezero/hirise.webp'))
  .extract({ left: 1700, top: 500, width: 2000, height: 1050 })
  .resize(W, H).modulate({ brightness: 0.85 }).tint({ r: 236, g: 160, b: 110 }).toBuffer()

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".96"/><stop offset=".55" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <path d="M640 470 C 720 420, 820 380, 900 330 S 1010 250, 1060 210" fill="none" stroke="#ffb25b" stroke-width="5" stroke-linecap="round"/>
  <circle cx="640" cy="470" r="9" fill="#f5f7fb" stroke="#000" stroke-width="3"/>
  <circle cx="1060" cy="210" r="9" fill="#ff8d7a" stroke="#000" stroke-width="3"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#f5f7fb">
    <text x="64" y="96" font-family="Menlo, monospace" font-size="16" letter-spacing="3" fill="#ffb25b">NASA SPACE APPS 2026 · MARTIAN MAP</text>
    <text x="64" y="250" font-size="92" font-weight="700" letter-spacing="-4">Plan a walk</text>
    <text x="64" y="345" font-size="92" font-weight="700" letter-spacing="-4">on Mars.</text>
    <text x="64" y="410" font-size="26" fill="#c9ced8">Real NASA maps. A safe route. Science on the way.</text>
    <g transform="translate(64 500)">
      <circle cx="8" cy="-8" r="8" fill="#7fe0a8"/>
      <text x="28" y="0" font-size="30" font-weight="700" fill="#7fe0a8">GO</text>
      <text x="92" y="0" font-family="Menlo, monospace" font-size="18" fill="#c9ced8">Jezero Crater · HiRISE · CTX · MOLA · THEMIS · RAD</text>
    </g>
    <text x="64" y="580" font-size="22" font-weight="700">Marswalk Planner</text>
  </g>
</svg>`
await sharp(photo).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toFile(path.join(ROOT, 'public/og.png'))
console.log('public/og.png written')
