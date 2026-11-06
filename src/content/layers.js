// Map layers for a site, grouped by what they tell a walker. `source` keys match sources.js DATA.
// kind: 'image' (baked file in meta.layers or meta.photo), 'elevation' / 'slope' (drawn in the
// browser from the height map), 'traverse', 'stops', 'radius'.
export const LAYER_GROUPS = [
  {
    id: 'shape', name: 'Ground shape',
    layers: [
      { id: 'elevation', kind: 'elevation', name: 'Height colours', plain: 'Dark = low, bright = high', mission: 'MRO', instrument: 'CTX height map', res: '40 m', badge: 'derived', source: 'ctxDem', on: false, opacity: 0.3 },
      { id: 'slope', kind: 'slope', name: 'Steepness', plain: 'Clear = easy · amber = careful · red = too steep', mission: 'MRO', instrument: 'CTX height map', res: '40 m', badge: 'derived', source: 'ctxDem', on: true, opacity: 0.35 },
      { id: 'rough', kind: 'rough', name: 'Rocky ground', plain: 'Clear = smooth · rust = rough, rocky-looking ground in the HiRISE photo', mission: 'MRO', instrument: 'HiRISE photo texture', res: '40 m', badge: 'derived', source: 'hirise', on: false, opacity: 0.75 },
      { id: 'relief', kind: 'image', file: 'relief', name: 'Regional relief', plain: 'Hills and craters around the site', mission: 'MGS + Mars Express', instrument: 'MOLA + HRSC', res: '200 m', badge: 'nasa', source: 'hrsc', on: false, opacity: 0.8 },
    ],
  },
  {
    id: 'photos', name: 'Photos from orbit',
    layers: [
      { id: 'hirise', kind: 'image', file: 'hirise', name: 'Sharpest photo', plain: 'Rocks, sand ripples and rover tracks near the landing site', mission: 'MRO', instrument: 'HiRISE camera', res: '25 cm (shown at ~1.3 m)', badge: 'nasa', source: 'hirise', on: true, opacity: 1 },
      { id: 'photo', kind: 'photo', name: 'Close-up photo', plain: 'What the ground looks like', mission: 'MRO', instrument: 'CTX camera', res: '6 m', badge: 'nasa', source: 'ctxPhoto', on: true, opacity: 1 },
      { id: 'viking', kind: 'image', file: 'viking', name: 'Colour view', plain: 'Mars in colour, around the site', mission: 'Viking 1 & 2', instrument: 'VIS cameras', res: '232 m', badge: 'nasa', source: 'viking', on: true, opacity: 1 },
    ],
  },
  {
    id: 'ground', name: 'Ground type',
    layers: [
      { id: 'themis-night', kind: 'image', file: 'themis-night', name: 'Rock or dust?', plain: 'Bright = solid rock (stays warm at night) · dark = loose dust or sand', mission: 'Mars Odyssey', instrument: 'THEMIS night infrared', res: '100 m', badge: 'nasa', source: 'themisNight', on: false, opacity: 0.75 },
      { id: 'themis-day', kind: 'image', file: 'themis-day', name: 'Daytime heat', plain: 'Sunny slopes warm, shaded slopes cool', mission: 'Mars Odyssey', instrument: 'THEMIS day infrared', res: '100 m', badge: 'nasa', source: 'themisDay', on: false, opacity: 0.75 },
    ],
  },
  {
    id: 'rovers', name: 'Rovers and science',
    layers: [
      { id: 'traverse', kind: 'traverse', name: 'Perseverance’s real path', plain: 'Every drive since landing in 2021', mission: 'Mars 2020', instrument: 'JPL MMGIS', res: 'metres', badge: 'nasa', source: 'traverse', on: true, opacity: 0.5 },
      { id: 'stops', kind: 'stops', name: 'Science stops', plain: 'Where Perseverance took rock samples', mission: 'Mars 2020', instrument: 'Sample list', res: '—', badge: 'nasa', source: 'samples', on: true, opacity: 1 },
    ],
  },
  {
    id: 'safety', name: 'Safety',
    layers: [
      { id: 'radius', kind: 'radius', name: 'Walk-back circle', plain: 'Stay inside to always be able to walk home', mission: 'Planner', instrument: 'Your setting', res: '—', badge: 'illustrative', on: true, opacity: 0.9 },
    ],
  },
]

export const ICE_NOTE = 'The SWIM project (MRO, Mars Odyssey and MGS data) finds its strongest buried-ice candidates at Arcadia Planitia and Deuteronilus Mensae, far north of Jezero. In this planner, water at Jezero comes from recycling, not from ice.'

// Gale uses different products for the same layers; only the wording and credits change.
const GALE = {
  elevation: { instrument: 'HiRISE height map', source: 'galeDem' },
  slope: { instrument: 'HiRISE height map', source: 'galeDem' },
  hirise: { plain: 'Rocks, sand and the boxwork ridges around the habitat', source: 'galeHirise' },
  photo: { instrument: 'HiRISE mosaic', res: '25 cm (shown at ~10 m)', source: 'galeHirise' },
  traverse: { name: 'Curiosity\u2019s real path', plain: 'Every drive since landing in 2012', mission: 'Curiosity (MSL)', source: 'mslTraverse' },
  stops: { plain: 'Where Curiosity drilled and studied rocks', mission: 'Curiosity (MSL)', instrument: 'NASA news and team blog', source: 'mslStops' },
}
const SITE_LAYERS = { gale: GALE }

/** The layer list for a planning site, with that site's own products and credits. */
export function layerGroupsFor(siteId) {
  const o = SITE_LAYERS[siteId]
  if (!o) return LAYER_GROUPS
  return LAYER_GROUPS.map((g) => ({ ...g, layers: g.layers.map((l) => (o[l.id] ? { ...l, ...o[l.id] } : l)) }))
}

const ICE_NOTES = {
  gale: 'The SWIM project (MRO, Mars Odyssey and MGS data) finds its strongest buried-ice candidates at Arcadia Planitia and Deuteronilus Mensae, far from Gale near the equator. In this planner, water at Gale comes from recycling, not from ice.',
}
export const iceNoteFor = (siteId) => ICE_NOTES[siteId] || ICE_NOTE
