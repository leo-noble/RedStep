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
  sites: { mission: 'Redstep', instrument: 'Curated sites', product: 'Rover landing points and NASA 2015 human landing-zone workshop sites', resolution: 'Point coordinates', citation: 'Each site lists its coordinate source on the map.' },
  assumption: { mission: 'Redstep', instrument: 'Planning assumption', product: 'Editable in the walk settings', resolution: 'Set by you' },
  schematic: { mission: 'Redstep', instrument: 'Hero scene', product: 'Orbital schematic drawn in your browser', resolution: 'Not to scale', citation: 'Planet maps: Viking (Mars), Blue Marble (Earth); distances and lighting composed for legibility.' },
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
  lead: 'Plan it with real NASA mission data, and get a straight answer: GO or NO-GO, and why.',
  ctaPrimary: 'Choose a landing site',
  ctaWalk: 'Plan a walk at Jezero',
  ctaMap: 'Or open the Mars map',
  boardSay: 'Plan the first human walk on Mars from real NASA mission data, and get a straight answer: GO, CAUTION or NO-GO, with the reasons.',
  ctaWalkShort: 'Plan a walk',
  skipIntro: 'Skip intro',
  scrollCue: 'Scroll to fly',
  telemetryTitle: 'Mars · now',
  telemetryNote: 'Computed in your browser — not live telemetry.',
  chapters: [
    { id: 'launch', label: 'Leave Earth' },
    { id: 'cruise', label: 'Cruise' },
    { id: 'arrive', label: 'Arrive' },
    { id: 'choose', label: 'Mars map' },
  ],
  story: {
    launch: {
      title: 'The trip comes first',
      body: 'Before anyone walks on Mars, they spend months crossing open space. Scroll to fly there.',
    },
    layers: {
      title: 'Five missions, one map',
      body: 'MOLA height, HiRISE and CTX photos, THEMIS rock-or-dust infrared, TES dust and the Viking colour mosaic, plus Perseverance’s real path: stacked and blended on one Mars map, each layer labelled with its mission, instrument and resolution.',
      chips: ['mola', 'hirise', 'ctx', 'themis', 'tes', 'mdim', 'mmgis'],
    },
    cruise: {
      title: 'Space is the first hazard',
      body: 'Curiosity’s RAD instrument measured the radiation on the way to Mars and on the ground. Both numbers are real, and both are in the planner.',
    },
    arrive: {
      title: 'Walk out, walk back',
      body: 'Slope limits, suit air with a safety reserve, a walk-back circle and science stops worth the risk. You get a GO, CAUTION or NO-GO answer with its reasons.',
    },
    choose: {
      title: 'Choose your landing site',
      body: 'Drag the globe or pick a site. Walk planning is ready at Jezero Crater; the other sites open on the map.',
    },
  },
  walkthrough: [
    { title: 'Pick a place on Mars', body: 'One map stacks five missions: height, photos, rock or dust. Tap a crater to see what is there.', link: '/map', cta: 'Open the Mars map', img: '/home/map.webp', alt: 'The Mars map: a globe with landing sites and a list of places' },
    { title: 'Ask for a safe walk', body: 'At Jezero Crater the planner reads slope, suit air and sunlight, and draws a route past the science.', link: '/site/jezero', cta: 'Plan a walk', img: '/home/planner-before.webp', alt: 'The walk planner at Jezero Crater before a route is drawn' },
    { title: 'Get a straight answer', body: 'GO, CAUTION or NO-GO, with the reasons. Every number says where it came from.', link: '/sources', cta: 'See the sources', img: '/home/planner-after.webp', alt: 'The planner with a route drawn and a GO verdict' },
  ],

  // The map layers, one plate each. field: the picture's darkest large tone, so plate and page read as one surface.
  plates: [
    { img: '/data/jezero/hirise-2k.webp', source: 'hirise', field: '#22211f', pos: '50% 55%', title: 'Five missions, one map', text: 'The sharpest layer: MRO’s HiRISE camera, at 25 cm a pixel. Single boulders and sand ripples show up near the landing site.', alt: 'HiRISE photo of the floor of Jezero Crater: dark sand ripples, small craters and the edge of a pale rocky ridge.', link: '/site/jezero', cta: 'See it in the planner' },
    { img: '/data/jezero/ctx-photo-2k.webp', source: 'ctx', field: '#1d1c1b', pos: '50% 50%', title: 'The ground, everywhere', text: 'MRO’s CTX camera covers the whole region at 6 m a pixel, and its stereo pairs give the height map that every slope is read from.', alt: 'Black-and-white CTX photo of the Jezero region from orbit, with the crater floor and the old river delta.', link: '/site/jezero', cta: 'Plan a walk on it' },
    { img: '/data/jezero/themis-day.webp', source: 'themis', field: '#262525', pos: '50% 50%', title: 'Sun and shade', text: 'Mars Odyssey’s THEMIS camera sees heat at 100 m a pixel: sunny slopes run warm, shaded ones cool, and at night bare rock stays warmer than dust.', alt: 'THEMIS daytime infrared image of the Jezero region, bright on sunlit slopes and dark on shaded ones.', link: '/sources', cta: 'How we use it' },
    { img: '/data/jezero/relief.webp', source: 'mola', field: '#1f1f1f', pos: '50% 50%', grey: true, title: 'Hills and craters', text: 'A laser on Mars Global Surveyor and a camera on Mars Express measured the shape of the land around the site, at 200 m a pixel.', alt: 'Shaded relief of the land around Jezero Crater, showing the crater rim and smaller craters.', link: '/map', cta: 'Open the Mars map' },
    { img: '/data/jezero/viking.webp', source: 'mdim', field: '#2e170c', pos: '50% 50%', title: 'Mars in colour', text: 'Viking 1 and 2 photographed the planet in colour from orbit in the 1970s. Their mosaic is still the map’s colour view, at 232 m a pixel.', alt: 'Viking colour mosaic of the region around Jezero Crater in rust and tan.', link: '/map', cta: 'Open the Mars map' },
  ],
  many: {
    title: 'From data to an answer',
    body: 'The planner reads every layer at once, tests the walk against your limits, and gives one answer you can act on.',
    steps: [
      { name: 'Gather', text: 'Five missions’ maps, a height map for slopes, and the time and sunlight at the site right now.', img: '/home/map.webp', alt: 'The Mars map: a globe with landing sites and a list of places', link: '/map' },
      { name: 'Check', text: 'Each stretch of the walk is tested for slope, suit air with a reserve, sunlight and the way back.', img: '/home/planner-before.webp', alt: 'The walk planner at Jezero Crater before a route is drawn', link: '/site/jezero' },
      { name: 'Answer', text: 'GO, CAUTION or NO-GO, with every reason, and where each number came from.', img: '/home/planner-after.webp', alt: 'The planner with a route drawn and a GO verdict', link: '/site/jezero' },
    ],
  },
  figures: {
    title: 'Help is minutes away',
    light: 'For a radio message from Jezero to reach Earth, right now. A reply takes as long again.',
    reserve: 'Of the suit’s air stays untouched on every walk. You can change it in the planner.',
  },
  triptych: {
    title: 'Stand where the rovers stood',
    body: 'Three real panoramas, from Perseverance at Jezero and Curiosity in Gale Crater.',
    cta: 'Look around in Street view',
  },
  close: {
    title: 'Take the first red step',
    body: 'Pick a landing site on the real Mars map, or go straight to Jezero and plan a walk.',
    cta: 'Open the Mars map',
  },
  credits: 'Pictures: rover panoramas NASA/JPL-Caltech/MSSS/ASU; HiRISE NASA/JPL/University of Arizona via USGS; CTX NASA/JPL/MSSS; THEMIS NASA/JPL/ASU; Viking NASA/USGS; relief NASA/GSFC and ESA/DLR/FU Berlin. Every source is on',

}
