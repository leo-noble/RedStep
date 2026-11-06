// Every number the walk planner uses. `badge` is the honesty label shown next to it.
// Editable values have min/max/step and appear in the "Walk settings" panel.
export const WALK = {
  flatPace: {
    label: 'Walking speed on flat ground',
    value: 2.0, unit: 'km/h', min: 1, max: 4, step: 0.1, badge: 'illustrative',
    note: 'Walking in a pressure suit is slow and tiring. This is a planning value; real speed depends on the suit and the ground. Hills slow you down using Tobler’s hiking rule, scaled to this flat speed.',
  },
  suitHours: {
    label: 'Suit air at normal effort',
    value: 7, unit: 'h', min: 4, max: 10, step: 0.5, badge: 'illustrative',
    note: 'The ISS suit backpack supplies oxygen for up to about 7 hours (NASA Inspector General). No Mars suit exists yet, so this is a planning value.',
  },
  reserve: {
    label: 'Safety reserve kept for emergencies',
    value: 25, unit: '%', min: 10, max: 50, step: 5, badge: 'illustrative',
    note: 'Never plan to use all your air. This share of the suit’s air is kept untouched.',
  },
  climbCost: {
    label: 'Extra air used when climbing',
    value: 40, unit: '% per 10% grade', min: 0, max: 100, step: 5, badge: 'illustrative',
    note: 'Climbing makes you breathe harder. At 10% uphill grade you use air this much faster.',
  },
  load: {
    label: 'Gear you carry',
    value: 10, unit: 'kg', min: 0, max: 60, step: 1, badge: 'illustrative',
    note: 'Tools, sample bags, water and spare batteries. Walking effort grows roughly with the total weight you move (Pandolf et al. 1977), so gear makes the suit use air faster. Mars gravity lightens you and your gear by the same share, so the ratio holds.',
  },
  crew: {
    label: 'Astronauts on the walk',
    value: 2, unit: '', min: 1, max: 2, step: 1, badge: 'illustrative',
    note: 'Space station spacewalks are done by two astronauts working together (NASA spacewalk log), so each can help the other. With two, the suit that uses air fastest decides when you both turn back.',
  },
  buddyLoad: {
    label: 'Gear your buddy carries',
    value: 15, unit: 'kg', min: 0, max: 60, step: 1, badge: 'illustrative',
    note: 'Only counts when two of you walk. Whoever carries more breathes harder, so sharing the load evenly stretches the walk.',
  },
  suitedMass: {
    label: 'You plus your suit',
    value: 150, unit: 'kg', min: 100, max: 250, step: 5, badge: 'illustrative',
    note: 'An astronaut with a full pressure suit and life-support pack. No Mars suit exists yet, so this is a planning value. With 150 kg here, 15 kg of gear adds about 10% to air use.',
  },
  greenSlope: {
    label: 'Easy ground below',
    value: 10, unit: '°', min: 5, max: 20, step: 1, badge: 'illustrative',
    note: 'Ground flatter than this is easy to walk in a suit.',
  },
  redSlope: {
    label: 'Too steep above',
    value: 15, unit: '°', min: 10, max: 30, step: 1, badge: 'illustrative',
    note: 'The planner refuses ground steeper than this. A fall in a pressure suit can be fatal.',
  },
  steepAllowance: {
    label: 'Steep ground allowed before a warning',
    value: 150, unit: 'm', min: 0, max: 1000, step: 25, badge: 'illustrative',
    note: 'Short steep steps are fine with walking poles. Longer stretches of ground between the easy and too-steep limits give a CAUTION.',
  },
  walkBack: {
    label: 'Walk-back circle',
    value: 5, unit: 'km', min: 1, max: 15, step: 0.5, badge: 'illustrative',
    note: 'Stay within this distance of the habitat so you can always walk home if a rover breaks.',
  },
  minSun: {
    label: 'Lowest safe sun height',
    value: 10, unit: '°', min: 0, max: 30, step: 1, badge: 'illustrative',
    note: 'Low sun means long shadows that hide holes and rocks, and the suit gets cold fast.',
  },
  startHour: {
    label: 'Leave the habitat at (Mars local time)',
    value: 9, unit: 'h', min: 5, max: 17, step: 0.25, badge: 'illustrative',
    note: 'Local true solar time at the site. 12:00 is when the sun is highest.',
  },
  roverSpeed: {
    label: 'Rover driving speed',
    value: 6, unit: 'km/h', min: 2, max: 15, step: 1, badge: 'illustrative',
    note: 'Only used when a rover drops you off. Apollo 15\u2019s Moon rover averaged about 9 km/h while driving (27.8 km in 3 h 2 min, NASA NSSDCA); rough Mars ground keeps a planning value lower.',
  },
  stopMinutes: {
    label: 'Time at each science stop',
    value: 30, unit: 'min', min: 5, max: 120, step: 5, badge: 'illustrative',
    note: 'Time to photograph, sample and pack. Air keeps running at rest effort.',
  },
}

// Fixed physical values. Each has a source key from sources.js.
export const FACTS = {
  surfaceDose: { value: 0.64, unit: 'mSv/day', badge: 'nasa', source: 'rad', note: 'Curiosity RAD, Gale Crater surface, dose equivalent (Hassler et al. 2014). NASA press materials round this to about 0.67.' },
  cruiseDose: { value: 1.84, unit: 'mSv/day', badge: 'nasa', source: 'radCruise', note: 'Curiosity RAD inside the spacecraft on the way to Mars (Zeitlin et al. 2013).' },
  careerLimit: { value: 600, unit: 'mSv', badge: 'nasa', source: 'nasaStd', note: 'NASA astronaut career limit, NASA-STD-3001 Vol. 1 (2022).' },
  gravity: { value: 0.38, unit: 'g', badge: 'nasa', source: 'marsFacts' },
  solLength: { value: '24 h 39 m 35 s', badge: 'nasa', source: 'marsFacts' },
  sunlight: { value: 43, unit: '% of Earth’s', badge: 'nasa', source: 'marsFacts' },
  pressure: { value: 6, unit: 'hPa (Earth: 1,013)', badge: 'nasa', source: 'nssdc', note: 'Mean surface pressure about 6.36 hPa; it varies with season and height.' },
  meanTemp: { value: -63, unit: '°C', badge: 'nasa', source: 'marsFacts' },
  dustSeason: { value: 'Ls 180°–360°', badge: 'nasa', source: 'dustStorms', note: 'Southern spring and summer, when Mars is closest to the Sun. Big dust storms usually start in this half of the year.' },
}
