// Bakes the offline demo data from public NASA / USGS sources.
//
//   npm run bake
//
// What it makes (all written to public/data, so the built site needs no network):
//   globe/      Mars, Earth and Moon textures for the home page (equirectangular, as served)
//   jezero/     elevation grid, CTX photo, mission layers, Perseverance path, meta.json
//
// Sources (see src/content/sources.js for the credits shown in the app):
//   - USGS Astrogeology, Mars 2020 TRN CTX DTM + orthomosaic (Fergason et al. 2020)
//   - NASA Mars Trek WMTS tiles (Viking MDIM 2.1, MOLA/HRSC, THEMIS, TES)
//   - NASA JPL MMGIS Perseverance traverse + waypoints
//   - NASA Earth Observatory Blue Marble, NASA Moon Trek LRO WAC
//
// The map draws in Web Mercator, so every map image is warped row by row from the source's
// equirectangular grid. Latitude and longitude stay planetocentric Mars degrees; all distances
// in the app use the Mars radius, never the map's Earth-sized one.

import { fromFile } from 'geotiff'
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data-raw')
const OUT = path.join(ROOT, 'public', 'data')
const CACHE = path.join(RAW, 'trek-cache')
const TREK = 'https://trek.nasa.gov/tiles'

const JEZERO_RAW = path.join(RAW, 'jezero')
const DEM_FILE = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
const ORTHO_FILE = 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif'
const USGS = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX'
const MMGIS = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json'

const R_MARS = 3396190 // the DEM's own sphere radius (Mars 2000 IAU)
const DEG = Math.PI / 180

// ---------- helpers ----------

const exists = (p) => fs.access(p).then(() => true, () => false)

async function download(url, file) {
  if (await exists(file)) return file
  await fs.mkdir(path.dirname(file), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
  return file
}

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))
const latFromMercY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG

// Fetch a Trek equirectangular mosaic for a bbox at zoom z.
// Trek grid: zoom z has 2^(z+1) x 2^z tiles of 256 px, top-left at (-180, 90).
async function trekMosaic({ body = 'Mars', layer, ext, z, bbox }) {
  const deg = 180 / 2 ** z / 256 // degrees per pixel
  const [w, s, e, n] = bbox
  const c0 = Math.floor((w + 180) / deg / 256), c1 = Math.floor((e + 180 - 1e-9) / deg / 256)
  const r0 = Math.floor((90 - n) / deg / 256), r1 = Math.floor((90 - s - 1e-9) / deg / 256)
  const cols = c1 - c0 + 1, rows = r1 - r0 + 1
  const W = cols * 256, H = rows * 256
  const data = new Uint8Array(W * H * 4)
  const jobs = []
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) jobs.push([r, c])
  let i = 0
  async function worker() {
    while (i < jobs.length) {
      const [r, c] = jobs[i++]
      const url = `${TREK}/${body}/EQ/${layer}/1.0.0/default/default028mm/${z}/${r}/${c}.${ext}`
      const file = path.join(CACHE, body, layer, String(z), `${r}_${c}.${ext}`)
      let buf
      try { buf = await fs.readFile(await download(url, file)) } catch { continue } // missing tile = no coverage
      const { data: px } = await sharp(buf).ensureAlpha().resize(256, 256, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
      const ox = (c - c0) * 256, oy = (r - r0) * 256
      for (let y = 0; y < 256; y++) data.set(px.subarray(y * 1024, y * 1024 + 1024), ((oy + y) * W + ox) * 4)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return { data, W, H, channels: 4, bbox: [c0 * 256 * deg - 180, 90 - (r1 + 1) * 256 * deg, (c1 + 1) * 256 * deg - 180, 90 - r0 * 256 * deg] }
}

// Bilinear sample of an equirectangular raster at lon/lat. Returns channels into out.
function sample(src, lon, lat, out) {
  const [w, s, e, n] = src.bbox
  const fx = ((lon - w) / (e - w)) * src.W - 0.5, fy = ((n - lat) / (n - s)) * src.H - 0.5
  const x0 = Math.max(0, Math.min(src.W - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(src.H - 1, Math.floor(fy)))
  const x1 = Math.min(src.W - 1, x0 + 1), y1 = Math.min(src.H - 1, y0 + 1)
  const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0))
  const C = src.channels
  for (let k = 0; k < C; k++) {
    const a = src.data[(y0 * src.W + x0) * C + k], b = src.data[(y0 * src.W + x1) * C + k]
    const c = src.data[(y1 * src.W + x0) * C + k], d = src.data[(y1 * src.W + x1) * C + k]
    out[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }
  return out
}

// Warp an equirectangular raster into a Web Mercator image covering bbox, outW pixels wide.
function toMercator(src, bbox, outW) {
  const [w, s, e, n] = bbox
  const y0 = mercY(n), y1 = mercY(s)
  const outH = Math.round((outW * (y1 - y0)) / ((-(e - w) * DEG)))
  const C = src.channels
  const data = new Uint8Array(outW * outH * C)
  const px = new Float64Array(C)
  for (let j = 0; j < outH; j++) {
    const lat = latFromMercY(y0 + ((j + 0.5) / outH) * (y1 - y0))
    for (let i = 0; i < outW; i++) {
      sample(src, w + ((i + 0.5) / outW) * (e - w), lat, px)
      for (let k = 0; k < C; k++) data[(j * outW + i) * C + k] = px[k]
    }
  }
  return { data, W: outW, H: outH, channels: C }
}

// Fade the alpha channel towards the edges so an inset image blends into the one below it.
function feather(img, frac) {
  const { W, H, data, channels: C } = img
  const fx = W * frac, fy = H * frac
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = Math.min(1, i / fx, (W - 1 - i) / fx, j / fy, (H - 1 - j) / fy)
    const a = (j * W + i) * C + C - 1
    data[a] = data[a] * k * k * (3 - 2 * k)
  }
}

async function writeImage(img, file, { quality = 80, lossless = false } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  let p = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.W, height: img.H, channels: img.channels } })
  if (file.endsWith('.jpg')) p = p.flatten({ background: '#000' }).jpeg({ quality, mozjpeg: true })
  else p = p.webp({ quality, lossless, effort: 5, alphaQuality: 90 })
  await p.toFile(file)
  const { size } = await fs.stat(file)
  console.log(`  ${path.relative(ROOT, file)}  ${img.W}x${img.H}  ${(size / 1024).toFixed(0)} KB`)
}

// ---------- globe textures ----------

async function bakeGlobe() {
  console.log('globe textures')
  const dir = path.join(OUT, 'globe')
  const world = [-180, -90, 180, 90]
  // the home page's planets (src/home/MarsGlobeHero.jsx)
  const viking = await trekMosaic({ layer: 'Mars_Viking_MDIM21_ClrMosaic_global_232m', ext: 'jpg', z: 3, bbox: world })
  await writeImage(await shrink(viking, 2048), path.join(dir, 'mars-viking-2k.jpg'), { quality: 80 })
  const moon = await trekMosaic({ body: 'Moon', layer: 'LRO_WAC_Mosaic_Global_303ppd_v02', ext: 'jpg', z: 2, bbox: world })
  await writeImage(moon, path.join(dir, 'moon-lro-2k.jpg'), { quality: 80 })

  const eo = 'https://eoimages.gsfc.nasa.gov/images/imagerecords'
  const day = await download(`${eo}/57000/57752/land_shallow_topo_2048.jpg`, path.join(RAW, 'earth', 'blue-marble-2048.jpg'))
  await sharp(day).resize(2048, 1024).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, 'earth-day-2k.jpg'))
  console.log('  earth written')
}

async function shrink(img, W) {
  const H = Math.round((img.H * W) / img.W)
  const { data } = await sharp(Buffer.from(img.data), { raw: { width: img.W, height: img.H, channels: img.channels } })
    .resize(W, H).raw().toBuffer({ resolveWithObject: true })
  return { ...img, data, W, H }
}

// ---------- Jezero ----------

async function readGeoTiff(file) {
  const tif = await fromFile(file)
  const im = await tif.getImage()
  const [x0, y0, x1, y1] = im.getBoundingBox() // projected metres, equirectangular on R_MARS
  const bbox = [x0 / R_MARS / DEG, y0 / R_MARS / DEG, x1 / R_MARS / DEG, y1 / R_MARS / DEG]
  const [band] = await im.readRasters({ samples: [0] })
  return { band, W: im.getWidth(), H: im.getHeight(), bbox, nodata: im.getGDALNoData() }
}

async function bakeJezero() {
  console.log('jezero')
  const dir = path.join(OUT, 'jezero')
  await fs.mkdir(dir, { recursive: true })
  await download(`${USGS}/${DEM_FILE}`, path.join(JEZERO_RAW, DEM_FILE))
  await download(`${USGS}/${ORTHO_FILE}`, path.join(JEZERO_RAW, ORTHO_FILE))

  // Elevation: average 2x2 blocks of the 20 m DEM into a 40 m grid, stored as Int16 decimetres.
  const dem = await readGeoTiff(path.join(JEZERO_RAW, DEM_FILE))
  const F = 2
  const gw = Math.floor(dem.W / F), gh = Math.floor(dem.H / F)
  const grid = new Int16Array(gw * gh)
  let min = Infinity, max = -Infinity, holes = 0
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    let sum = 0, n = 0
    for (let dy = 0; dy < F; dy++) for (let dx = 0; dx < F; dx++) {
      const v = dem.band[(j * F + dy) * dem.W + i * F + dx]
      if (v > -1e30 && Number.isFinite(v)) { sum += v; n++ }
    }
    if (!n) { grid[j * gw + i] = -32768; holes++; continue }
    const v = sum / n
    if (v < min) min = v
    if (v > max) max = v
    grid[j * gw + i] = Math.round(v * 10)
  }
  await fs.writeFile(path.join(dir, 'elevation.i16'), Buffer.from(grid.buffer))
  const [w, s, e, n] = dem.bbox
  const gridBbox = [w, n - ((gh * F) / dem.H) * (n - s), w + ((gw * F) / dem.W) * (e - w), n]
  console.log(`  elevation grid ${gw}x${gh}, ${min.toFixed(1)}..${max.toFixed(1)} m, holes ${holes}`)

  // CTX photo, warped to Mercator.
  const ortho = await readGeoTiff(path.join(JEZERO_RAW, ORTHO_FILE))
  const orthoSrc = { data: ortho.band, W: ortho.W, H: ortho.H, channels: 1, bbox: ortho.bbox }
  // grey + alpha, with feathered edges so the inset blends into the colour map below it
  const photo = toMercator(orthoSrc, gridBbox, 4096)
  const ga = new Uint8Array(photo.W * photo.H * 2)
  for (let k = 0; k < photo.W * photo.H; k++) { ga[k * 2] = photo.data[k]; ga[k * 2 + 1] = photo.data[k] ? 255 : 0 }
  const photoGA = { data: ga, W: photo.W, H: photo.H, channels: 2 }
  feather(photoGA, 0.035)
  await writeImage(photoGA, path.join(dir, 'ctx-photo.webp'), { quality: 78 })

  // Regional context and mission layers (Trek), cropped wider than the DEM.
  const ctx = [76.55, 17.75, 78.35, 19.15]
  const layers = [
    ['relief', 'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw', 'jpg', 8, ctx, 1400],
    ['viking', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg', 7, ctx, 1400],
    ['themis-day', 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', 'png', 9, ctx, 1800],
    ['themis-night', 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', 'png', 9, ctx, 1800],
  ]
  const layerMeta = {}
  for (const [id, layer, ext, z, bbox, outW] of layers) {
    const src = await trekMosaic({ layer, ext, z, bbox })
    const img = toMercator(src, bbox, outW)
    feather(img, 0.06)
    await writeImage(img, path.join(dir, `${id}.webp`), { quality: 80 })
    layerMeta[id] = { file: `${id}.webp`, bbox, trekLayer: layer, zoom: z }
  }

  // HiRISE close-up of the main walking area (landing site to the delta front), from Trek tiles.
  // 25 cm native; zoom 15 tiles give ~1.3 m per pixel, plenty for walk planning and small enough to ship.
  const hiBbox = [77.37, 18.415, 77.47, 18.478]
  const hi = await trekMosaic({ layer: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', ext: 'png', z: 15, bbox: hiBbox })
  const hiImg = toMercator(hi, hiBbox, 4096)
  feather(hiImg, 0.04)
  await writeImage(hiImg, path.join(dir, 'hirise.webp'), { quality: 70 })
  layerMeta.hirise = { file: 'hirise.webp', bbox: hiBbox, trekLayer: 'JEZ_hirise_soc_006_orthoMosaic_25cm', zoom: 15 }

  // THEMIS night-time infrared on the elevation grid: warm at night = rocky ground, cool = dust/sand.
  // Stored 0..255 per grid cell, used by the route finder as a "loose ground" penalty.
  const night = await trekMosaic({ layer: 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', ext: 'png', z: 9, bbox: gridBbox })
  const nightGrid = new Uint8Array(gw * gh)
  const px = new Float64Array(4)
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const lon = gridBbox[0] + ((i + 0.5) / gw) * (gridBbox[2] - gridBbox[0])
    const lat = gridBbox[3] - ((j + 0.5) / gh) * (gridBbox[3] - gridBbox[1])
    nightGrid[j * gw + i] = sample(night, lon, lat, px)[0]
  }
  await fs.writeFile(path.join(dir, 'themis-night.u8'), Buffer.from(nightGrid.buffer))

  // Perseverance traverse + waypoints (JPL MMGIS), thinned for the map.
  const trav = JSON.parse(await fs.readFile(await download(`${MMGIS}/M20_traverse.json`, path.join(RAW, 'm20', 'M20_traverse.json')), 'utf8'))
  const wps = JSON.parse(await fs.readFile(await download(`${MMGIS}/M20_waypoints.json`, path.join(RAW, 'm20', 'M20_waypoints.json')), 'utf8'))
  const round = (c) => [+c[0].toFixed(6), +c[1].toFixed(6)]
  const line = []
  for (const f of trav.features) for (const c of f.geometry.coordinates) {
    const p = round(c), q = line[line.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.00005) line.push(p) // ~3 m on Mars
  }
  const lastSol = Math.max(...trav.features.map((f) => f.properties.sol))
  const stops = wps.features.filter((f) => f.properties.final === 'y').map((f) => ({
    sol: f.properties.sol, lon: +f.properties.lon.toFixed(6), lat: +f.properties.lat.toFixed(6),
    elev: Math.round(f.properties.elev_geoid), km: +f.properties.dist_km,
  }))
  await fs.writeFile(path.join(dir, 'perseverance.json'), JSON.stringify({
    source: `${MMGIS}/M20_traverse.json`, lastSol, totalKm: stops[stops.length - 1].km, line, stops,
  }))
  console.log(`  perseverance path: ${line.length} points, ${stops.length} stops, to sol ${lastSol}`)

  const meta = {
    id: 'jezero',
    grid: { w: gw, h: gh, bbox: gridBbox, cellDeg: [(gridBbox[2] - gridBbox[0]) / gw, (gridBbox[3] - gridBbox[1]) / gh], unit: 'decimetres', nodata: -32768, min, max, radius: R_MARS },
    photo: { file: 'ctx-photo.webp', bbox: gridBbox },
    layers: layerMeta,
    built: new Date().toISOString().slice(0, 10),
  }
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1))
}

// ---------- other sites: map layers only (no walk planning) ----------

async function bakeContexts() {
  const { SITES } = await import('../src/content/sites.js')
  for (const site of SITES.filter((x) => !x.planner)) {
    console.log(site.id)
    const dir = path.join(OUT, site.id)
    await fs.mkdir(dir, { recursive: true })
    const bbox = [site.lon - 1.1, site.lat - 0.75, site.lon + 1.1, site.lat + 0.75]
    const layers = {}
    for (const [id, layer, ext, z, outW] of [
      ['viking', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg', 7, 1400],
      ['relief', 'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw', 'jpg', 8, 1600],
      ['themis-day', 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', 'png', 9, 1800],
      ['themis-night', 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', 'png', 9, 1800],
    ]) {
      const src = await trekMosaic({ layer, ext, z, bbox })
      const img = toMercator(src, bbox, outW)
      feather(img, 0.06)
      await writeImage(img, path.join(dir, `${id}.webp`), { quality: 78 })
      layers[id] = { file: `${id}.webp`, bbox, trekLayer: layer, zoom: z }
    }
    let traverse = null
    if (site.id === 'gale') {
      const t = JSON.parse(await fs.readFile(await download(`https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json`, path.join(RAW, 'msl', 'MSL_traverse.json')), 'utf8'))
      const line = []
      const pts = (g) => (g.type === 'MultiLineString' ? g.coordinates.flat() : g.coordinates)
      for (const f of t.features) for (const c of pts(f.geometry)) {
        const p = [+c[0].toFixed(5), +c[1].toFixed(5)], q = line[line.length - 1]
        if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.0002) line.push(p)
      }
      traverse = { file: 'traverse.json', source: 'NASA JPL MMGIS MSL_traverse.json', lastSol: Math.max(...t.features.map((f) => f.properties.sol || 0)) }
      await fs.writeFile(path.join(dir, 'traverse.json'), JSON.stringify(line))
      console.log(`  curiosity path: ${line.length} points`)
    }
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ id: site.id, bbox, center: [site.lon, site.lat], layers, traverse, built: new Date().toISOString().slice(0, 10) }, null, 1))
  }
}

// ---------- world map: Web Mercator tile pyramids + IAU place names ----------

// Cut an equirectangular world raster into 256 px Web Mercator tiles, zooms 0..maxZ.
async function tilePyramid(src, dir, maxZ, { ext = 'jpg', quality = 78 } = {}) {
  const px = new Float64Array(src.channels)
  let count = 0, bytes = 0
  for (let z = 0; z <= maxZ; z++) {
    const n = 2 ** z
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const data = new Uint8Array(256 * 256 * 3)
      for (let j = 0; j < 256; j++) {
        const my = Math.PI * (1 - (2 * (y + (j + 0.5) / 256)) / n)
        const lat = Math.atan(Math.sinh(my)) / DEG
        for (let i = 0; i < 256; i++) {
          const lon = ((x + (i + 0.5) / 256) / n) * 360 - 180
          sample(src, lon, lat, px)
          const k = (j * 256 + i) * 3
          data[k] = px[0]; data[k + 1] = px[1]; data[k + 2] = px[2]
        }
      }
      const file = path.join(dir, String(z), String(x), `${y}.${ext}`)
      await fs.mkdir(path.dirname(file), { recursive: true })
      let p = sharp(Buffer.from(data.buffer), { raw: { width: 256, height: 256, channels: 3 } })
      p = ext === 'jpg' ? p.jpeg({ quality, mozjpeg: true }) : p.webp({ quality })
      await p.toFile(file)
      bytes += (await fs.stat(file)).size
      count++
    }
  }
  console.log(`  ${path.relative(ROOT, dir)}: ${count} tiles, ${(bytes / 1048576).toFixed(1)} MB`)
}

const PLAIN_TYPE = {
  'Crater, craters': 'Crater', 'Vallis, valles': 'Valley', 'Albedo Feature': 'Light or dark region', 'Fossa, fossae': 'Long trough',
  'Mons, montes': 'Mountain', 'Dorsum, dorsa': 'Ridge', 'Mensa, mensae': 'Flat-topped hills', 'Planum, plana': 'High plain',
  'Chaos, chaoses': 'Broken ground', 'Chasma, chasmata': 'Canyon', 'Rupes, rupes': 'Cliff', 'Collis, colles': 'Hills',
  'Tholus, tholi': 'Small dome mountain', 'Patera, paterae': 'Volcano crater', 'Cavus, cavi': 'Hollows', 'Catena, catenae': 'Chain of craters',
  'Sulcus, sulci': 'Grooved ground', 'Scopulus, scopuli': 'Uneven cliff', 'Terra, terrae': 'Highland region', 'Planitia, planitiae': 'Low plain',
  'Labyrinthus, labyrinthi': 'Maze of valleys', 'Labes, labes': 'Landslide', 'Unda, undae': 'Dune field', 'Lingula, lingulae': 'Tongue of ice cap',
  'Palus, paludes': 'Plain', 'Fluctus, fluctus': 'Lava flow', 'Serpens, serpentes': 'Winding ridge', 'Vastitas, vastitates': 'Vast plain',
}
// Label priority: 1 shows from far away, 3 only when zoomed in.
const RANK = { 'Planitia, planitiae': 1, 'Terra, terrae': 1, 'Vastitas, vastitates': 1, 'Planum, plana': 1, 'Mons, montes': 2, 'Chasma, chasmata': 2, 'Labyrinthus, labyrinthi': 2, 'Vallis, valles': 2, 'Fossa, fossae': 2, 'Unda, undae': 2 }

async function bakeWorld() {
  console.log('world tiles')
  const tiles = path.join(OUT, 'tiles')
  const world = [-180, -90, 180, 90]
  const viking = await trekMosaic({ layer: 'Mars_Viking_MDIM21_ClrMosaic_global_232m', ext: 'jpg', z: 4, bbox: world })
  await tilePyramid(viking, path.join(tiles, 'viking'), 5)
  const mola = await trekMosaic({ layer: 'Mars_MGS_MOLA_ClrShade_merge_global_463m', ext: 'jpg', z: 3, bbox: world })
  await tilePyramid(mola, path.join(tiles, 'mola'), 4)
  const dust = await trekMosaic({ layer: 'TES_Dust', ext: 'png', z: 1, bbox: world })
  await tilePyramid(dust, path.join(tiles, 'dust'), 2)

  // IAU/USGS Gazetteer of Planetary Nomenclature, as served by NASA Mars Trek.
  const url = 'https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?bbox=-180,-90,180,90&start=0&rows=2000&facetKeys=itemType&facetValues=nomenclature'
  const raw = JSON.parse(await fs.readFile(await download(url, path.join(RAW, 'nomenclature', 'trek.json')), 'utf8'))
  const names = raw.response.docs
    .filter((d) => d.productCat2 && d.productCat2 !== 'Unofficial' && /^POINT/.test(d.shape))
    .map((d) => {
      const [lon, lat] = d.shape.match(/-?[\d.]+/g).map(Number)
      return [d.title, +lon.toFixed(3), +lat.toFixed(3), PLAIN_TYPE[d.productCat2] || d.productCat2, RANK[d.productCat2] || 3]
    })
    .sort((a, b) => a[4] - b[4] || a[0].localeCompare(b[0]))
  await fs.writeFile(path.join(OUT, 'names.json'), JSON.stringify({ source: 'IAU/USGS Gazetteer of Planetary Nomenclature via NASA Mars Trek', fields: ['name', 'lon', 'lat', 'type', 'rank'], names }))
  console.log(`  names.json: ${names.length} official names`)
}

const only = process.argv[2]
if (!only || only === 'globe') await bakeGlobe()
if (!only || only === 'jezero') await bakeJezero()
if (!only || only === 'sites') await bakeContexts()
if (!only || only === 'world') await bakeWorld()
console.log('done')
