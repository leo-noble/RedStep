# Redstep: Space Apps 2026 submission kit

Draft text for the project page of "Interplanetary Survival Guide: Martian Map". Each section matches a field on the Space Apps project form. Items marked **TEAM** need your own words or a check before you submit.

- Demo: https://redstep.vercel.app (mirror: https://marswalk-planner.vercel.app)
- Code: https://github.com/leo-noble/RedStep (make sure the repository is public before you submit)
- Video (30 s): `brag-output-2026-11-06-142043/brag.mp4`. Upload it to YouTube or Vimeo and paste the link; the form wants a link, not a file.

---

## High-level summary (about 100 words)

Redstep is a layered Mars map that plans the first walks of a crew on Mars. It stacks data from six spacecraft on one map, then turns it into a plain answer: GO, CAUTION or NO-GO, with the reasons. The planner reads slope, suit air, sunlight, radiation and live space weather. It handles two astronauts and a rover drop-off, and it routes around steep and rocky ground. Start from the science: plan a walk to Curiosity's 2025 boxwork on Mount Sharp, fly it in a helmet display, then take a timed checklist on your wrist. Every number says where it came from.

## Project details

**What it does**
- **Mars map:** 11 layers from MRO (HiRISE, CTX), Mars Global Surveyor (MOLA, TES), Mars Odyssey (THEMIS), Viking, Curiosity and Perseverance on one map. Each layer shows its mission, instrument and resolution.
- **Walk planner (Jezero and Gale):**
  - **Suggested walk:** press one button for a safe route past real science stops, or draw your own route.
  - **What the planner checks:**
    - slope, from 40 m height grids;
    - suit air, including a turn-back point and a reserve;
    - carried gear;
    - sun height, from NASA GISS Mars24;
    - radiation dose, from Curiosity RAD;
    - Earth radio delay;
    - live space weather, from NASA DONKI and NOAA GOES;
    - rocky ground, from HiRISE photo texture.
  - **Buddy walks:** two astronauts walk together. The suit using air fastest sets the turn-back for both, and the answer is NO-GO if only one of them could finish.
  - **Rover drop-off:** a rover drives the crew out, the walk starts there, and you're warned if the rover parks beyond walking distance of home.
- **Science first at Gale:** three stops on Curiosity's real 2025 route. Each sits at the rover's logged position on the day named in NASA's own reports:
  - Gediz Vallis sulfur stones;
  - Altadena;
  - Monte Grande boxwork.
- **During the walk:**
  - **Helmet view:** a suit display over the 3D route showing heading, air, sun, next stop and the turn-back alert.
  - **Cuff view:** a tablet checklist for the arm that works offline.
  - **Brief:** a printable page with a wrist card.
- **Honesty:** every number carries one tag, NASA DATA, DERIVED or ILLUSTRATIVE. A Sources page lists every product and method. The Tips panel is a fixed set of rules, not an AI.

**How it works**
- **App:** React with MapLibre, and three.js for the 3D intro. Route search (A* and Dijkstra) runs in a Web Worker on a 40 m grid.
- **Data:** baked once from NASA and USGS sources by `scripts/bake-site.mjs`, so the site runs offline after the first visit.
- **Gale heights:** the USGS HiRISE height mosaic, 1 m. We read its 8 m overview over HTTP and average it to 40 m. Along Curiosity's whole 38 km drive, the result matches the rover's own logged heights within a few metres, and our tests check this.
- **Tests:** 41 automated tests cover slopes, paths, air, buddy and rover rules, space weather, the wrist card and the Gale terrain.

**Benefits and impact**
- **Who it's for:** the first Mars crews and the people who plan their walks.
- **What it gives them:** one place to weigh science against risk, with the reason for every answer.
- **For the public and classrooms:** the same tool shows what a first walk on Mars would really take.

**Tools and languages:** JavaScript (React 19, Vite), MapLibre GL, three.js, Web Workers, Node.js (geotiff, sharp) for data baking, Vitest, Vercel.

**TEAM:** add what you hope to achieve next, and any personal motivation.

## Use of Artificial Intelligence (AI)

**TEAM: check and edit this.** Space Apps asks every team to disclose AI use honestly.

> We used Claude Code (Anthropic), an AI coding assistant, to help write and test the app's code, the data-baking scripts and the page text, and to assemble the demo video from screen captures of the app. We checked the data sources, numbers and science stop positions against the NASA, JPL and USGS sources listed below. The app contains no AI features: its advice comes from fixed rules. No images in the app or video are AI-generated; maps and photos are NASA, USGS and JPL products, and the video shows the running app.

(Change the last sentence if any logo, icon or illustration was made with an AI image tool.)

## NASA data

- MRO HiRISE: Jezero orthomosaic (via NASA Mars Trek); Curiosity site mosaic `curiosity_hirise_mosaic` (via Mars Trek)
- MRO CTX: Jezero DTM and orthomosaic (USGS Astrogeology, Mars 2020 TRN; Fergason et al. 2020)
- USGS MSL Gale DEM mosaic v3, 1 m from HiRISE stereo (Calef and Parker 2016)
- MGS MOLA and MOLA/HRSC blended relief (USGS, ESA/DLR/FU Berlin, via Mars Trek)
- Mars Odyssey THEMIS day and night infrared mosaics (ASU, via Mars Trek)
- MGS TES dust cover index; Viking MDIM 2.1 colour mosaic (via Mars Trek)
- Perseverance and Curiosity traverses and waypoints (NASA JPL MMGIS)
- Perseverance rock samples list (NASA)
- Curiosity RAD surface dose (Hassler et al. 2014)
- NASA DONKI space weather (CCMC)
- NASA GISS Mars24 sun-time algorithm
- Rover panoramas (NASA Photojournal)
- Curiosity boxwork and Gediz Vallis sources: JPL news (18 Jul 2024), Photojournal PIA26559 and PIA26363, Curiosity team blog (sols 4568–4569, 4689–4694, 4723–4730)

## Other data and references

- NOAA SWPC GOES proton flux (space-weather fallback)
- Pandolf, Givoni and Goldman 1977, walking with loads (carried-gear air use)
- Tobler's hiking function (walking pace on slopes)
- NASA SP-2009-566, Mars Design Reference Architecture 5.0 (pressurised rovers in pairs)
- NASA NSSDCA Apollo Lunar Roving Vehicle (drive speeds and range)
- The full list with links is in the app at /sources.

## Demo video script (what the 30 s video shows)

1. **0:00–0:07:** the app's 3D intro: a rocket leaves Earth for Mars. On screen: "Plan the first walk on Mars."
2. **0:07–0:10:** the Mars map. On screen: "Five missions. One map."
3. **0:10–0:15:** the Gale planner, with Curiosity's boxwork and a suggested walk that gets a GO. On screen: "Start from the science."
4. **0:15–0:21:** the helmet view over real 3D terrain.
5. **0:21–0:24:** the cuff checklist on a tablet.
6. **0:24–0:28:** "Every number shows its source," with the three data tags.
7. **0:28–0:30:** Redstep, redstep.vercel.app.
