// All site-wide copy. Change the project name here.
export const SITE = {
  name: 'Marswalk Planner',
  by: 'a Loadstone project',
  tagline: 'Plan a walk on another world.',
  pitch: 'Pick a place on Mars, draw a walk, and get an instant answer: is it safe, why, and what science you will do on the way. Every number comes from real NASA missions.',
  pitchShort: 'Pick a place on Mars, draw a walk, and get a clear answer: safe or not, and why. Built from real NASA mission data.',
  challenge: 'NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map',
  disclaimer: 'Independent student project for the NASA Space Apps Challenge 2026. Not affiliated with or endorsed by NASA.',
  team: [
    // { name: 'Your name', role: 'Role' },
  ],
}

// Top menu: kept to four plain choices. Everything else is linked from the footer.
export const NAV = [
  { to: '/', label: 'Mars map' },
  { to: '/site/jezero', label: 'Plan a walk' },
  { to: '/guide', label: 'Survival guide' },
  { to: '/about', label: 'About' },
]

export const FOOTER_NAV = [
  ...NAV,
  { to: '/habitat', label: 'Base calculator' },
  { to: '/sources', label: 'Data & sources' },
]

// The three honesty labels used on every number.
export const BADGES = {
  nasa: { label: 'NASA data', long: 'Measured by a NASA mission. We only display it.' },
  derived: { label: 'Derived', long: 'Calculated by this app from NASA data. The method is shown.' },
  illustrative: { label: 'Illustrative', long: 'An assumption for planning. You can change it.' },
}
