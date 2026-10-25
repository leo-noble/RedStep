# Changelog

## Round 2: data layer, minimap, street view, ambient, polish (24–25 Oct 2026)

1. **Data layer** (`src/data/`): every page, map and the route worker read Mars data through one module, checked against `schema.js`. Today's files sit behind `adapters/baked.js`; NASA's official dataset needs one adapter and `VITE_MARS_DATA`. Schema and how-to: `docs/data-schema.md`. `/sources` shows the source in use.
2. **Minimap** in Fly along: you + heading, route by steepness, home, end/turn-back, stops, steepest point, known hazards; collapsible; ⤢ opens a large pop-up with legend. Not on the planning map.
3. **Street view**: three real NASA panoramas (PIA24264 landing site sol 3, PIA24663 Van Zyl Overlook sols 53–64, PIA24626 Mont Mercou sol 3090) with rover, sol, date, PIA id and credit always visible; positions from JPL waypoints. Other stops: Demo view from orbit, labelled "DEMO · NOT ROVER PHOTOS".
4. **Ambient**: the intro flight never blocks (map loads underneath; any input skips). Dust-and-sky layer behind info pages and the planner loading screen; footer switch; still for reduced motion.
5. **Mission-control accents** on the minimap, verdict header, key readouts and Fly along HUD only.
6. **Polish**: main JS 1,425 kB → 360 kB (world map loads on its own, prefetched during the intro); 4k globe texture dropped (1.4 MB, never visible); friendly error page when a page fails to load; Street view starts on photographed ground on phones.


## Branch `space-apps/judging-upgrades` (24 Oct 2026)

### Done (one commit each, verified in the browser)
1. **Team block** (About): driven by `SITE.team`; hidden until real names are added. Dev note removed.
2. **Honest headline**: home copy now says walk planning is at Jezero; one-line reason in `SITE.whyJezero` (data facts; team may reword).
3. **Loading feedback** (/site/jezero): disabled buttons, spinner and `Loading terrain… N%`, slow-link hint, readable errors with Try again. Tested with `scripts/serve-throttled.mjs` (1.6 Mbit/s, 150 ms), not Chrome's own throttling.
4. **Offline**: own service worker + manifest + icons; precaches app shell and Jezero data (125 files, 10.8 MB). Verified by stopping the server and reloading: planner loaded and returned GO.
5. **Default walk on arrival**: Medium suggestion runs automatically when the URL has no walk.
6. **Try a risky walk**: picked from the terrain (nearest stop whose straight line crosses > 15° ground); shows NO-GO with reasons. Unit-tested on the real grid.
7. **Backtest vs Perseverance** (`scripts/backtest.mjs`, shown on /sources, DERIVED): 95.06% of the 46.03 km path passes the 15° rule; 4.94% flagged in 12 stretches (rim climb). Orbit slope vs rover tilt at 706 stops: r = 0.81, median diff 1.6°. All 382 drives fit the air budget (longest 489 m).
11. **44 px tap targets** (`src/styles/touch.css`, phones < 768 px and touch screens): 0 controls under 44 px on every route at 375×812 on the live site; inline text links left as is (WCAG inline exception). Planner zoom buttons, scale and draw hint now follow the action bar's real height on phones (they were partly hidden behind it).
12. *(part)* **HydrateFallback warning**: lazy pages have a fallback; console clean on all routes on the live site.

Deployed to production 24 Oct 2026 (entry `index-By8mWoHc.js`).

### Still open
- 8 sensitivity view (speed × suit air → verdict grid)
- 9 home promise line under the headline
- 10 page weight: before = main JS 1,424 kB (407 kB gz), home loads 6,685 KB images/data, og.png 1.1 MB; lazy-load Explorer/maplibre, drop 4K texture, lazy site images, shrink og.png
- 12 (rest) h1 on /site/jezero, per-route titles, real 404 (Vercel 404.html + limited rewrites)
- P3 (after 28 Oct): requirements map + official dataset
- Fill in: team names/roles; confirm `SITE.whyJezero`
