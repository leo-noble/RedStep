# Mars data: one door, one schema

Every piece of Mars data in the app (maps, the height map, places, hazards, rover paths and the
numbers behind the verdict) is read through **`src/data/index.js`**. Pages, the map components
and the route worker never open data files themselves. To use a different data source, such as
NASA's official Space Apps dataset (released 28 Oct 2026), write one adapter; no page code changes.

```
src/data/
  index.js            the functions the app calls; checks every result against the schema
  schema.js           the shapes (JSDoc types) and the checks
  adapters/baked.js   today's source: files in public/data/ (scripts/bake-site.mjs) + src/content/
```

## Switching source

1. Copy `src/data/adapters/baked.js` to `src/data/adapters/<name>.js` and make each function return
   the shapes below from the new files. Keep functions you don't need by delegating to `baked`.
2. Add it to `ADAPTERS` in `src/data/index.js`.
3. Build with `VITE_MARS_DATA=<name> npm run build` (or change `DEFAULT`).
4. `npm test`, then open `/site/jezero`. A missing or malformed field stops with a readable message
   (for example `site data for "jezero": grid needs unit, nodata and radius`), shown on the planner's
   error screen.
5. `/sources` shows which source is in use.

Keep the honesty tags: anything measured is `nasa`, anything computed here is `derived`, anything
assumed is `illustrative`.

## What an adapter returns

Coordinates are planetocentric degrees, **longitude east**. A `bbox` is `[west, south, east, north]`.

| Function | Returns | Used by |
|---|---|---|
| `sites()` | list of sites `{id, name, lat, lon, planner, kind, mission, why, coordSource}` | world map, planner, brief |
| `meta(id)` | **SiteMeta** (below) | world map, planner map, lite site, worker |
| `terrain(id, meta, onBytes)` | **Terrain** `{meta, elev: Int16Array, ground: Uint8Array}` | route worker |
| `places(id)` | `{home: Place, stops: ScienceStop[]}` | planner, brief |
| `hazards(id)` | **Hazard[]** (may be empty) | planner minimap |
| `traverse(id, meta)` | `{line: [lon, lat][], source, lastSol?}` or `null` | maps |
| `walkInputs()` | `{settings: WALK, facts: FACTS}` (see `src/content/assumptions.js`) | verdict, panels, guide |
| `names()` | `[[name, lon, lat, type, rank], …]` IAU names (rank = label priority: 1 shows from far away, 3 only when zoomed in) | world map search |
| `backtest(id)` | backtest result (`scripts/backtest.mjs`) | /sources |
| `tiles(id)` | URL template `…/{z}/{x}/{y}.jpg` for `viking`, `mola`, `dust` | world map |
| `texture(file)` | URL of a whole-planet texture | intro globe |

### SiteMeta

```js
{
  id: 'jezero',
  bbox: [76.55, 17.75, 78.35, 19.15],         // area covered by the site's maps
  center: [77.45, 18.44],                      // optional
  grid: {                                      // only where walks can be planned
    w: 798, h: 756,                            // columns, rows
    bbox: [77.1605, 18.2110, 77.6990, 18.7212],
    cellDeg: [0.000675, 0.000675],
    unit: 'decimetres',                        // or 'metres'
    nodata: -32768,
    radius: 3396190,                           // metres, for distances
    min: -2710.6, max: -1515.9,                // metres, for the height colours
  },
  photo:  { url, bbox, source },               // main photo map (planner sites)
  layers: {                                    // any of: viking, relief, hirise, themis-day, themis-night
    hirise: { url, bbox, source: 'JEZ_hirise_soc_006_orthoMosaic_25cm' },
  },
  traverse: { url, source, lastSol },          // optional rover path file
}
```

### Terrain

`elev` holds `grid.w × grid.h` heights in `grid.unit`, row by row from the **north-west** corner;
`nodata` marks gaps. `ground` holds one byte per cell, 0 (dark, loose ground) to 255 (bright, rock);
today this is THEMIS night infrared, and the planner adds cost on dark cells. If a new dataset has a
different ground product, scale it to 0–255 with the same meaning.

Slope is **derived** from `elev` in the browser (Horn's method), so a new height map needs no slope file.

### Place and ScienceStop

```js
home:  { id: 'habitat', name: 'Habitat', lon: 77.45089, lat: 18.44463, note }
stops: [{ id: 'sid', name, lon, lat,
          value: 2,          // 1–5 science priority (our own judgement, used for the science score)
          minutes: 20,       // time spent at the stop
          region, what, why, evidence, bring }]
```

### Hazard

Slope and loose ground already come from the terrain. This list is for fixed, known dangers that
the height map cannot show (boulder fields, unstable ground, dust deposits).

```js
{ id: 'h1', kind: 'rocks',        // steep | loose | rocks | dust | other
  lon: 77.44, lat: 18.43,
  radiusM: 150,                   // optional
  note: 'Boulder field below the scarp.',
  source: 'HiRISE ESP_… rock abundance map',
  badge: 'nasa' }                 // nasa | derived | illustrative
```

The baked data has **no hazard catalogue**, so `hazards()` returns `[]` today.

### Walk inputs

`WALK` and `FACTS` are maps of `{label, value, unit, min?, max?, step?, badge, note?, source?}`.
The planner reads `value`; the panels show `label`, `unit` and the badge. Changing a value changes
every verdict, so cite the source on `/sources`.

## What stays outside the data layer

- Rules and maths (`src/compute/`, `src/lib/advisor.js`, `src/lib/mars24.js`) are code, not data.
- Survival guide text, glossary and habitat calculator numbers (`src/content/survival.js`,
  `habitat.js`) are content with their own sources.
