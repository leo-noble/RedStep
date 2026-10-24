// Base calculator assumptions. Every value is shown and editable in the app.
export const BASE = {
  crew: { label: 'Crew', value: 4, min: 1, max: 12, step: 1, unit: 'people', badge: 'illustrative' },
  o2: { label: 'Oxygen per person', value: 0.84, min: 0.6, max: 1.2, step: 0.01, unit: 'kg/day', badge: 'nasa', source: 'o2Need' },
  moxie: { label: 'Oxygen from one MOXIE-size unit', value: 12, min: 6, max: 12, step: 1, unit: 'g/hour', badge: 'nasa', source: 'moxie', note: 'MOXIE’s best hourly output in tests. Running it non-stop for a crew is our assumption.' },
  water: { label: 'Water per person', value: 30, min: 10, max: 60, step: 1, unit: 'L/sol', badge: 'illustrative', note: 'Drinking, food, washing.' },
  recycle: { label: 'Water recycled', value: 90, min: 50, max: 98, step: 1, unit: '%', badge: 'illustrative', note: 'The space station reached 98% in 2023. We start lower to stay careful.', source: 'issWater' },
  iceShare: { label: 'Ice in dug-up ground', value: 10, min: 1, max: 50, step: 1, unit: '% by mass', badge: 'illustrative', note: 'A guess. No ice deposit is confirmed at Jezero.' },
  kcal: { label: 'Food energy per person', value: 2500, min: 1800, max: 3500, step: 50, unit: 'kcal/day', badge: 'illustrative' },
  farmArea: { label: 'Growing area built', value: 80, min: 0, max: 600, step: 10, unit: 'm²', badge: 'illustrative' },
  yield: { label: 'Food from one square metre', value: 125, min: 50, max: 300, step: 5, unit: 'kcal/m²/day', badge: 'illustrative', note: 'A planning number for lit hydroponic beds.' },
  farmWater: { label: 'Water for the plants', value: 4, min: 1, max: 10, step: 0.5, unit: 'L/m²/day', badge: 'illustrative' },
  cover: { label: 'Soil piled on the habitat', value: 2, min: 0, max: 5, step: 0.5, unit: 'm', badge: 'illustrative', note: 'More soil blocks more radiation, but is harder to dig and must be held up safely.' },
}

export const SHELTERS = [
  { id: 'buried', name: 'Buried module', line: 'A habitat covered with a few metres of Mars soil. Built from parts we can test on Earth.' },
  { id: 'tube', name: 'Lava tube (unconfirmed)', line: 'Orbiters have seen possible cave skylights on Mars. None has been explored, so this stays a hypothetical option.' },
]
