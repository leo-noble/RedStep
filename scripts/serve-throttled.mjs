// Serve the built site (dist/) slowly, to test loading states on a poor connection.
//   npm run build && node scripts/serve-throttled.mjs [port] [kbit/s] [latency ms]
// Defaults approximate a "Slow 4G" profile: 1600 kbit/s down, 150 ms latency. No compression,
// no caching headers, unknown paths fall back to index.html (like the Vercel rewrite).
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const [port = 4180, kbit = 1600, latency = 150] = process.argv.slice(2).map(Number)
const BYTES_PER_SEC = (kbit * 1000) / 8
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = path.join(ROOT, url)
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return }
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html') } catch { file = path.join(ROOT, 'index.html') }
  let body
  try { body = await fs.readFile(file) } catch { res.writeHead(404).end(); return }
  await sleep(latency)
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-store' })
  const chunk = 16384
  for (let o = 0; o < body.length; o += chunk) {
    res.write(body.subarray(o, o + chunk))
    await sleep((chunk / BYTES_PER_SEC) * 1000)
  }
  res.end()
}).listen(port, () => console.log(`throttled ${kbit} kbit/s, ${latency} ms: http://localhost:${port}`))
