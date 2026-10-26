// Copy and data for the cinematic homepage (src/home). Numbers and sites come from the
// app's own content files, so the homepage always agrees with the map and the planner.
import { SITE, BADGES as APP_BADGES } from '../content/site.js'
import { SITES } from '../content/sites.js'
import { WALK, FACTS } from '../content/assumptions.js'

export { SITE }

// Same three honesty labels as the rest of the app, in the homepage's chip style.
export const BADGES = Object.fromEntries(
  Object.entries(APP_BADGES).map(([key, b]) => [key, { key, label: b.label.toUpperCase(), long: b.long }]),
)

// Source details shown in badge tooltips on the homepage.
export const SOURCES = {
  mola: { mission: 'MGS', instrument: 'MOLA', product: 'Laser altimeter elevation', resolution: '≈463 m/px' },
  tes: { mission: 'MGS', instrument: 'TES', product: 'Dust cover index', resolution: '≈3.5 km' },
  hirise: { mission: 'MRO', instrument: 'HiRISE', product: 'Orthoimagery near the landing site', resolution: '25 cm/px' },
  ctx: { mission: 'MRO', instrument: 'CTX', product: 'Imagery and stereo height map', resolution: '6 m/px' },
  themis: { mission: 'Odyssey', instrument: 'THEMIS', product: 'Day and night infrared (rock vs dust)', resolution: '100 m/px' },
  mdim: { mission: 'Viking', instrument: 'VIS', product: 'Global colour mosaic', resolution: '232 m/px' },
  mmgis: { mission: 'Mars 2020', instrument: 'JPL MMGIS', product: 'Perseverance’s real path and samples', resolution: 'metres' },
  rad: { mission: 'Curiosity', instrument: 'RAD', product: 'Cruise and surface dose rate', resolution: 'Point measurement', citation: 'Hassler et al. (2014); Zeitlin et al. (2013)' },
  mars24: { mission: 'NASA GISS', instrument: 'Mars24 algorithm', product: 'Mars time, season, sun position', resolution: 'Analytic', citation: 'Allison & McEwen (2000)' },
  ephemeris: { mission: 'Analytic ephemeris', instrument: 'Earth + Mars orbits', product: 'Earth–Mars distance and light time', resolution: '≈±0.3 min' },
  sites: { mission: 'Marswalk Planner', instrument: 'Curated sites', product: 'Rover landing points and NASA 2015 human landing-zone workshop sites', resolution: 'Point coordinates', citation: 'Each site lists its coordinate source on the map.' },
  assumption: { mission: 'Marswalk Planner', instrument: 'Planning assumption', product: 'Editable in the walk settings', resolution: 'Set by you' },
  schematic: { mission: 'Marswalk Planner', instrument: 'Hero scene', product: 'Orbital schematic drawn in your browser', resolution: 'Not to scale', citation: 'Planet maps: Viking (Mars), Blue Marble (Earth); distances and lighting composed for legibility.' },
}

export const CONSTANTS = {
  radCruise: FACTS.cruiseDose,
  radSurface: FACTS.surfaceDose,
  lightTimeRange: { value: '3.0–22.3', unit: 'min' },
}

export const SLOPE_THRESHOLDS = { go: WALK.greenSlope.value, caution: WALK.redSlope.value }
export const EVA_DEFAULTS = { walkBackRadiusKm: WALK.walkBack.value, reserveFraction: WALK.reserve.value / 100 }

export const LANDING_SITES = SITES.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  planner: s.planner,
  science: s.short,
  context: s.why,
  missions: [s.kind, s.mission],
}))
export const DEFAULT_SITE_ID = 'jezero'
export const getSite = (id) => LANDING_SITES.find((s) => s.id === id)

export const HOME = {
  kicker: 'NASA Space Apps Challenge 2026',
  titleLines: ['Plan the first', 'walk on '],
  titleAccent: 'Mars.',
  lead: 'One map built from NASA missions (height, steepness, dust, rock or sand, radiation and sunlight) that turns a landing site into a safe, science-rich Marswalk you can defend.',
  ctaPrimary: 'Choose a landing site',
  ctaMap: 'Open the Mars map',
  ctaMapShort: 'Mars map',
  skipIntro: 'Skip intro',
  scrollCue: 'Scroll to fly',
  telemetryTitle: 'Mars · now',
  telemetryNote: 'Computed in your browser — not live telemetry.',
  chapters: [
    { id: 'launch', n: '01', label: 'Leave Earth' },
    { id: 'cruise', n: '02', label: 'Cruise' },
    { id: 'arrive', n: '03', label: 'Arrive' },
    { id: 'choose', n: '04', label: 'Choose a site' },
  ],
  story: {
    layers: {
      eyebrow: '01 · Layered + integrated',
      title: 'Five missions. One map.',
      body: 'MOLA height, HiRISE and CTX photos, THEMIS rock-or-dust infrared, TES dust and the Viking colour mosaic, plus Perseverance’s real path: stacked and blended on one Mars map, each layer labelled with its mission, instrument and resolution.',
      chips: ['mola', 'hirise', 'ctx', 'themis', 'tes', 'mdim', 'mmgis'],
    },
    cruise: {
      eyebrow: '02 · The trip is the first hazard',
      title: 'Every number shows its source.',
      body: 'Curiosity’s RAD measured the dose on the way and on the ground. Mission Control is minutes away, so the plan has to be right before the hatch opens.',
    },
    arrive: {
      eyebrow: '03 · Plan a successful Marswalk',
      title: 'Walk out. Do science. Walk back.',
      body: 'Slope limits, suit air with a safety reserve, a walk-back circle and science stops worth the risk. You get a GO, CAUTION or NO-GO answer with its reasons.',
    },
    choose: {
      eyebrow: '04 · New science along the way',
      title: 'Choose your landing site.',
      body: 'Drag the globe or pick a site. Walk planning is ready at Jezero Crater; the other sites open on the map.',
    },
  },
  features: {
    eyebrow: 'What the planner does',
    title: 'From orbit to your first step.',
    lead: 'Four tools that work together, each one built on NASA data you can trace.',
    cards: [
      { art: 'layers', title: 'Layered maps', body: 'Toggle, blend and compare NASA layers, from the whole planet down to HiRISE photos at Jezero.', link: '/map', cta: 'Open the Mars map' },
      { art: 'missions', title: 'Six missions, one view', body: 'MGS, MRO, Odyssey, Viking, Curiosity and Perseverance, each named with its instrument and resolution.', link: '/sources', cta: 'See every source' },
      { art: 'walk', title: 'A walk you can defend', body: 'Slope-aware routing, suit air and reserve, a walk-back circle, Mars24 sun height and RAD dose.', link: '/site/jezero', cta: 'Plan a walk' },
      { art: 'science', title: 'Science along the way', body: 'Science stops with a reason and a time budget, weighed against the risk of getting there.', link: '/guide', cta: 'Read the survival guide' },
    ],
  },

}
