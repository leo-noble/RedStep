# Redstep site audit — fix prompt

Audited live at https://redstep.vercel.app on 2026-11-02, desktop (1280×800, 1440×900) and phone (375×812).
Paste everything below the line into a fresh Claude Code session in this repo.

---

You are fixing the Redstep site (Vite + React 19 + react-router 7 + MapLibre + three.js, static SPA on Vercel; the "backend" is the client-side route worker in `src/compute/` and the static files in `public/data/`). Below is an audit of the live deploy. Fix every item, in priority order. Keep the current mission-dossier look and Switzer type; this is a polish and bug pass, not a redesign. After each group, run `npm test` and `npm run build`, then check in the preview browser at 1280×800 and at 375×812 (mobile emulation) and screenshot the before/after.

## P0 — broken or blank

> Items 1–6 were fixed on 2026-11-02 (branch `feat/rocket-homepage`). Two corrections to the
> original audit: the 10 s black map was mostly the test browser not painting while its pane was
> hidden (the real issue was the whole map UI waiting for the first tiles), and the "hidden
> chapter 3 copy on phone" was wrong: big scroll jumps skipped its window; it shows fine.

1. ~~Map pages show a black screen~~ — fixed: the sidebar and controls show at once, the globe fades in, with a "Loading Mars imagery…" line meanwhile.
2. ~~Phone homepage: chapter 3 copy is hidden~~ — not a bug (see above). "10–15°" no longer wraps.
3. **Embedded map on the homepage collides with the site header.** When the scroll story reaches the map (desktop), the Explorer's own sidebar ("Mission sites" list) and top chips slide under the fixed site nav; the REDSTEP logo sits on top of the sidebar text. On phone, the map's globe/locate button and "PLANUM BOREUM" label sit under the header. Give the embedded Explorer a top offset equal to the nav height (use a CSS var like `--nav-h`) or hide the nav's background-less state over it.
4. **Planner toolbar is cut off on phone.** At 375 px only "Suggest another walk" and "Short / Medium / Lo…" are visible; Draw my own, Undo, Start over, Try a risky walk, Street view, Fly along in 3D and **Save the plan** are off-screen with no scroll hint. Wrap to two rows, or move secondary actions into a "More" menu / the bottom sheet, so Save the plan is always reachable.
5. **Route is fitted under the toolbar on phone.** `fitRoute` in `src/components/planner/MarsMap.jsx` uses `top: 90` on mobile but the header + toolbar are ~130 px, so the walk's start waypoint lands under the toolbar. Measure the toolbar and bottom sheet (or use CSS vars) and pass them as padding. On desktop it pads `left: 400` even when the sidebar is closed (`sb-closed`); pad by the real sidebar width.
6. **Map labels float off the planet.** On `/map` and the homepage globe, "Gale Crater" is drawn in empty space past the limb, and "Deuteronilus Mensae" overlaps another site dot. In `drawLabels` (`src/components/Explorer.jsx` ~line 236) the `horizon` cutoff is too loose; tighten it (≈ 80° from centre) and fade labels near the limb. Make sure the site dots layer uses the same cutoff so dot and label agree.

## P1 — looks clunky

7. **Homepage intro shows black discs before textures load.** On first paint the Moon and Mars render as flat black circles over the starfield (visible ~1 s at desktop). Hide each body until its texture resolves, or start from a tinted placeholder. Also preload or shrink `moon-lro-2k.jpg` (455 KB) — the Moon is tiny on screen; a 1k texture is enough. Same for Mars/Earth on phone.
8. **Hero composition at 1280×800.** The rocket's nose overlaps the "NASA SPACE APPS CHALLENGE 2026" kicker line; Mars is clipped by the right edge and collides with the 01–04 chapter rail. Move the rocket/Mars so nothing touches text or the rail, and give the rail its own gutter.
9. **"Skip intro" pill floats mid-screen** on top of the globe during the intro. Anchor it with the other HUD chrome (bottom-right, near the chapter rail) and match the HUD chip style.
10. **Hard day/night terminator on the Mars globe.** The shading is a straight vertical cut. Soften it with a gradient (a few degrees of twilight) so it reads as a sphere, not two halves.
11. **Map attribution overlaps the scale bar** ("ESA/DLR/FU Berlin · IAU" runs into "1000 km" on `/map`; on the planner the attribution box covers the scale bar and has a stray ⓘ). Stack them, or put the scale bar on the left and attribution compact/collapsed on the right.
12. **Site nav is transparent over the full-bleed planner map.** Over bright crater imagery the nav links and the EMERGENCY button wash out. Give the nav a solid/blurred background (`backdrop-filter`) on map pages.
13. **Phone emergency button is an unlabeled red dot.** Show "SOS" or a short label, and give it `aria-label="Emergency procedures"`.
14. **Phone menu has no scrim.** The open menu sits over live page content with nothing dimming it, and the page still scrolls. Add a backdrop, lock body scroll, close on backdrop tap and Esc, and trap focus.
15. **Homepage feature screenshots are desktop captures shrunk to ~340 px** on phone — unreadable. Serve phone-specific crops (or crop to the relevant panel) via `<picture>`/`srcset`, and add meaningful `alt` to `home/map.webp`, `planner-before.webp`, `planner-after.webp`, `verdict.webp` (they currently have none).
16. **Inconsistent CTA widths on phone.** Hero buttons are full width; the closing "Ready to plan a walk?" buttons are content-width. Make them match.
17. **Survival guide counts disagree.** Header says "0 of 7 quizzes passed" while the step label says "STEP 1 OF 8"; the step pills row is clipped ("Air" cut) with no scroll affordance; the "TRY IT" corner bracket overlaps its label. Fix the count wording, add an edge fade to the pill scroller, and nudge the bracket.
18. **Low-contrast micro text.** "Schematic · not to scale", the bottom HUD ticker (season / message-to-Earth / local time) and the dimmed EMERGENCY button over imagery fall below WCAG AA. Lift those to at least 4.5:1.
19. **A stray coloured patch** appears at the left edge of the Jezero planner map (looks like one height-colour tile drawn over the greyscale base). Check the overlay layer's bounds/opacity so it only shows when that layer is on.

## P2 — function, performance, SEO, a11y

20. **Every page has the same `<title>`.** `/map`, `/guide`, `/about`, `/habitat`, `/sources`, `/site/jezero` and 404 are all "Redstep · Plan a walk on Mars"; nothing in `src/` sets `document.title`. Add a per-route title (and meta description) via a small hook or react-router `meta`.
21. **Soft 404s and fake crawl files.** `/nope-404`, `/robots.txt` and `/sitemap.xml` all return 200 HTML (the SPA shell) because of the catch-all rewrite in `vercel.json`. Add real `public/robots.txt` and `public/sitemap.xml`, exclude them in the rewrite regex, and make the NotFound route set a "Not found" title and `noindex`.
22. **`og:image` is relative (`/og.png`).** Social scrapers need an absolute URL: `https://redstep.vercel.app/og.png`; add `og:url` and `twitter:card` too.
23. **Homepage eagerly pulls the whole map app.** The home route downloads MapPage, Explorer, Sidebar, advisor, NotFound chunks, maplibre-gl and its worker, plus ~30 Viking tiles, before the user scrolls near the map (≈ 1.7 MB transferred, DOM ready ~4.9 s, load ~8 s on this test). Only prefetch on idle *after* first interaction, or when chapter 3 enters the viewport. `HomePage.jsx` lines ~166–167 import them unconditionally.
24. **Six Switzer weights load on every page** (400/500/600/700/800/900). Drop to the 2–3 actually used, or use a variable font file, and `preload` only the hero weight.
25. **Tap targets under 44 px on phone:** "Open the Mars map →", "Plan a walk →", "See the sources →" links (14 px tall), footer links (15 px), the NASA DATA / DERIVED / ILLUSTRATIVE chips (22 px) and the planner ⓘ buttons (18 px). Add padding so each hit area is ≥ 44×44.
26. **Odd outbound link on the homepage:** a link to `nasa.gov/blogs/spacestation/2018/08/30/international-space-station-status-3/` (an ISS status post). Check it's the intended source; move it to Data & sources if so.
27. **Deploy target mismatch.** `npm run deploy` deploys to Vercel project `marswalk-planner`, and `package.json` is named `marswalk-planner`, while the live site is `redstep.vercel.app`. Confirm which project serves production and align the name so deploys don't go to the wrong project.
28. **Reduced motion.** Confirm the intro rocket sequence and scroll scenes respect `prefers-reduced-motion` (skip straight to the hero) — the planner already does this for `fitBounds`; the homepage should too.

## Done means

- No black-screen wait on any route; a visible loading state within 300 ms.
- At 375×812: no clipped toolbar, no hidden chapter copy, no text under the header, all tap targets ≥ 44 px, no horizontal scroll.
- At 1280×800: nothing overlaps the hero text, the chapter rail or the nav; labels stay on the globe.
- Unique titles per route, real robots/sitemap, absolute OG image, homepage transfer before scroll well under 1 MB.
- `npm test` and `npm run build` pass; before/after screenshots for items 1–19.
