// The manual: detailed help that stays out of the way until someone opens it.
export const MANUAL = {
  explore: [
    {
      title: 'Moving around',
      body: ['Drag to move. Scroll or pinch to zoom. Right-drag or two-finger drag to tilt and turn.', 'Search for any of the 1,779 official place names, or tap the map to drop a pin and see what is there.'],
    },
    {
      title: 'What the map shows',
      body: [
        'Colour: the Viking orbiters’ global colour mosaic (232 m per pixel).',
        'Height: MOLA laser heights from Mars Global Surveyor. Blue is low, red and white are high.',
        'Dust: how dusty the surface is, from the TES instrument on Mars Global Surveyor.',
        'Day and night: where the Sun is up on Mars right now, computed with NASA GISS’s Mars24 method.',
        'Zoom into a mission site to see sharper maps: CTX (6 m) and HiRISE (25 cm) at Jezero.',
      ],
    },
    {
      title: 'Place names',
      body: ['Names and positions come from the IAU/USGS Gazetteer of Planetary Nomenclature, served by NASA Mars Trek. Plain-language types (Crater, Canyon, Low plain) are our wording of the IAU feature types.'],
    },
  ],
  planner: [
    {
      title: 'Plan a walk in three steps',
      body: ['1. Press Suggest safe route, or Draw your own route by tapping the map.', '2. Read the verdict: GO, CAUTION or NO-GO, with the reasons.', '3. Fix what it flags, fly along in 3D, then open the Mission brief.'],
    },
    {
      title: 'Reading the verdict',
      body: [
        'NO-GO means something could kill you: ground steeper than your limit, not enough suit air to get home, or being out after dark.',
        'CAUTION means it is possible but risky: long steep stretches, a thin air margin, or going beyond the walk-back circle.',
        'Notes (dust season, radio blackout) do not change the verdict, but you should know them.',
      ],
    },
    {
      title: 'Turn-back point and walk-back circle',
      body: ['The turn-back point is the furthest place where the air you have used, plus the air to walk home the same way, still leaves your reserve untouched.', 'The walk-back circle is how far you may go from the habitat so you can always walk home if a rover breaks.'],
    },
    {
      title: 'Careful, Balanced, Bold',
      body: ['These choose how much of the usable suit air a suggested route may spend: 60%, 85% or all of it (the reserve is always kept). Bolder walks reach more science.'],
    },
    {
      title: 'Honesty labels',
      body: ['Blue dot: NASA data, measured by a mission. Orange dot: Derived, calculated here from NASA data. Grey ring: Illustrative, a planning guess you can change in Walk settings.'],
    },
  ],
}
