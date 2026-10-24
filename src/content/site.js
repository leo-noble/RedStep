// All site-wide copy. Change the project name here.
export const SITE = {
  name: 'Marswalk Planner',
  by: 'a Loadstone project',
  tagline: 'Plan a walk on another world.',
  pitch: 'Explore the whole planet, then plan a walk at Jezero Crater and get an instant answer: is it safe, why, and what science you will do on the way. Every number comes from real NASA missions.',
  pitchShort: 'Explore the whole planet, then plan a walk at Jezero Crater and get a clear answer: safe or not, and why.',
  // Why walk planning is only at Jezero. Data facts from scripts/bake-site.mjs; the team may reword.
  whyJezero: 'Walk planning works at Jezero Crater for now: USGS made a detailed 20 m height map there for Perseverance\u2019s landing, and the rover\u2019s real path lets us check the planner.',
  challenge: 'NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map',
  disclaimer: 'Independent student project for the NASA Space Apps Challenge 2026. Not affiliated with or endorsed by NASA.',
  // [FILL IN: names + roles] e.g. { name: 'Ada Lovelace', role: 'Data and science' }.
  // The About page shows the team block only when at least one real entry is here.
  team: [],
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
