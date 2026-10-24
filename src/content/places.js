// Famous places shown in the explorer's "Explore" list. Names match the IAU Gazetteer, so the
// position comes from names.json. Facts are deliberately rounded and come from NASA pages.
export const FAMOUS = [
  { name: 'Olympus Mons', short: 'Biggest volcano', fact: 'The tallest volcano known in the Solar System: more than 20 km high and about 600 km wide.', source: 'marsFacts' },
  { name: 'Valles Marineris', short: 'Giant canyon', fact: 'A canyon system more than 4,000 km long and up to 7 km deep. On Earth it would cross the United States.', source: 'marsFacts' },
  { name: 'Hellas Planitia', short: 'Deepest crater basin', fact: 'A giant impact basin about 2,300 km across. Its floor is the lowest ground on Mars.', source: 'marsFacts' },
  { name: 'Aeolis Mons', short: 'Mount Sharp, climbed by Curiosity', fact: 'Also called Mount Sharp: a mountain of layered rock about 5 km high that Curiosity has been climbing since 2014.', source: 'marsFacts' },
  { name: 'Tharsis Montes', short: 'Three giant volcanoes', fact: 'Three giant volcanoes in a row on the Tharsis bulge, a volcanic region the size of a continent.', source: 'marsFacts' },
  { name: 'Arcadia Planitia', short: 'Plain with buried ice', fact: 'The SWIM project ranks this plain among the best places for ice buried close to the surface.', source: 'ezWorkshop' },
  { name: 'Chryse Planitia', short: 'Viking 1 landed here', fact: 'Viking 1 landed here in July 1976, the first successful US landing on Mars.', source: 'marsFacts' },
  { name: 'Utopia Planitia', short: 'Viking 2 and Zhurong landed here', fact: 'A vast northern plain. Viking 2 landed here in 1976, and China’s Zhurong rover in 2021.', source: 'marsFacts' },
  { name: 'Meridiani Planum', short: 'Opportunity rover explored here', fact: 'The Opportunity rover explored here from 2004 to 2018 and found rocks that formed in water.', source: 'marsFacts' },
  { name: 'Gusev', short: 'Spirit rover landed here', fact: 'The Spirit rover landed in this crater in January 2004.', source: 'marsFacts' },
  { name: 'Planum Boreum', short: 'North polar ice cap', fact: 'The north polar cap: kilometres of stacked water ice and dust layers.', source: 'marsFacts' },
  { name: 'Noctis Labyrinthus', short: 'Maze of valleys', fact: 'A maze of deep valleys at the western end of Valles Marineris.', source: 'marsFacts' },
]

export const famousByName = Object.fromEntries(FAMOUS.map((f) => [f.name, f]))
