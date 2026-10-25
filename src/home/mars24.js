/* ==========================================================================
   Mars24 — NASA GISS algorithm (Allison & McEwen 2000, PSS 48, 215–235)
   https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
   Longitudes are handled east-positive (−180..180) at the API boundary and
   converted to Mars24's west-positive convention internally.
   ========================================================================== */

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const mod = (x, m) => ((x % m) + m) % m;

// TT − UTC = 32.184 s + 37 leap seconds (no leap second announced since 2017).
const TT_MINUS_UTC = 69.184;

// Planetary perturbation terms (table 5 of the algorithm).
const PBS = [
  [0.0071, 2.2353, 49.409],
  [0.0057, 2.7543, 168.173],
  [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704],
  [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];

const SEASONS = ['Northern spring', 'Northern summer', 'Northern autumn', 'Northern winter'];

/** Core Mars24 state for a JS Date (or ms timestamp). */
export function marsTime(date = Date.now()) {
  const ms = typeof date === 'number' ? date : date.getTime();
  const jdUT = ms / 86400000 + 2440587.5;
  const jdTT = jdUT + TT_MINUS_UTC / 86400;
  const dt = jdTT - 2451545.0; // days since J2000 (TT)

  const M = mod(19.3871 + 0.52402073 * dt, 360); // mean anomaly
  const alphaFMS = mod(270.3871 + 0.524038496 * dt, 360); // fictitious mean sun

  let pbs = 0;
  for (const [A, tau, phi] of PBS) pbs += A * cos((0.985626 * dt) / tau + phi);

  const nuMinusM =
    (10.691 + 3.0e-7 * dt) * sin(M) +
    0.623 * sin(2 * M) +
    0.05 * sin(3 * M) +
    0.005 * sin(4 * M) +
    0.0005 * sin(5 * M) +
    pbs;

  const Ls = mod(alphaFMS + nuMinusM, 360);

  // Equation of time (degrees)
  const EOT = 2.861 * sin(2 * Ls) - 0.071 * sin(4 * Ls) + 0.002 * sin(6 * Ls) - nuMinusM;

  // Mars Sol Date and Coordinated Mars Time (MTC, mean solar time at 0°)
  const MSD = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const MTC = mod(24 * MSD, 24);

  // Subsolar point
  const subsolarLonW = mod(MTC * 15 + EOT + 180, 360);
  const subsolarLonE = wrapLon(-subsolarLonW);
  const decl = Math.asin(0.42565 * sin(Ls)) / DEG + 0.25 * sin(Ls);

  // Heliocentric distance (AU) and ecliptic position of Mars
  const rAU =
    1.52367934 *
    (1.00436 - 0.09309 * cos(M) - 0.004336 * cos(2 * M) - 0.00031 * cos(3 * M) - 0.00003 * cos(4 * M));
  const helioLon = mod(Ls + 85.061 - 0.015 * sin(71 + 2 * Ls) - 5.5e-6 * dt, 360);
  const helioLat = 1.8497 * sin(Ls - 144.5);

  // Mars Year (Clancy et al. 2000 convention: MY1 began 1955-04-11).
  // Anchored on MY36 start (2021-02-07, Ls 0) and corrected at the wrap.
  const myApprox = 36 + (jdTT - 2459252.5) / 686.9726;
  let MY = Math.floor(myApprox);
  const frac = myApprox - MY;
  if (Ls < 60 && frac > 0.85) MY += 1;
  if (Ls > 300 && frac < 0.15) MY -= 1;

  return {
    jdUT,
    jdTT,
    dt,
    M,
    alphaFMS,
    nuMinusM,
    Ls,
    EOT,
    MSD,
    MTC,
    subsolarLonE,
    subsolarLonW,
    decl,
    rAU,
    helioLon,
    helioLat,
    MY,
    season: SEASONS[Math.floor(Ls / 90) % 4],
  };
}

/** Local true solar time (hours) at an east longitude. */
export function localSolarTime(m, lonE) {
  const lonW = mod(-lonE, 360);
  const LMST = mod(m.MTC - lonW / 15, 24);
  return mod(LMST + m.EOT / 15, 24);
}

/** Solar elevation (degrees above horizon) at planetocentric lat, east lon. */
export function solarElevation(m, lat, lonE) {
  const lonW = mod(-lonE, 360);
  const H = lonW - m.subsolarLonW; // hour angle
  const cosZ = sin(m.decl) * sin(lat) + cos(m.decl) * cos(lat) * cos(H);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / DEG;
}

/** Sun elevation curve across one sol for a site — used by the planner (M3). */
export function solarCurve(lat, lonE, date = Date.now(), samples = 97) {
  const m0 = marsTime(date);
  const start = typeof date === 'number' ? date : date.getTime();
  // Shift to local midnight (LTST 0) so the curve starts at the beginning of the sol.
  const ltst = localSolarTime(m0, lonE);
  const solMs = 88775244;
  const t0 = start - (ltst / 24) * solMs;
  const out = [];
  for (let i = 0; i < samples; i++) {
    const t = t0 + (i / (samples - 1)) * solMs;
    const m = marsTime(t);
    out.push({ hour: (i / (samples - 1)) * 24, elevation: solarElevation(m, lat, lonE) });
  }
  return out;
}

/** Earth heliocentric ecliptic position (low-precision solar formulae). */
function earthHelio(jdUT) {
  const n = jdUT - 2451545.0;
  const L = mod(280.46 + 0.9856474 * n, 360);
  const g = mod(357.528 + 0.9856003 * n, 360);
  const lambdaSun = L + 1.915 * sin(g) + 0.02 * sin(2 * g);
  const R = 1.00014 - 0.01671 * cos(g) - 0.00014 * cos(2 * g);
  return { lon: mod(lambdaSun + 180, 360), lat: 0, r: R };
}

const AU_KM = 149597870.7;
const C_KMS = 299792.458;

/** One-way Earth↔Mars light time (minutes) and distance (AU). */
export function earthMarsLightTime(date = Date.now()) {
  const m = marsTime(date);
  const e = earthHelio(m.jdUT);
  const toXYZ = (lon, lat, r) => [r * cos(lat) * cos(lon), r * cos(lat) * sin(lon), r * sin(lat)];
  const [mx, my, mz] = toXYZ(m.helioLon, m.helioLat, m.rAU);
  const [ex, ey, ez] = toXYZ(e.lon, e.lat, e.r);
  const dAU = Math.hypot(mx - ex, my - ey, mz - ez);
  const minutes = (dAU * AU_KM) / C_KMS / 60;
  // Sun–Earth–Mars elongation: small angle ⇒ solar conjunction comms blackout risk.
  const sunEarth = [-ex, -ey, -ez];
  const marsEarth = [mx - ex, my - ey, mz - ez];
  const dot = sunEarth[0] * marsEarth[0] + sunEarth[1] * marsEarth[1] + sunEarth[2] * marsEarth[2];
  const elongation = Math.acos(dot / (Math.hypot(...sunEarth) * dAU)) / DEG;
  return { minutes, dAU, elongation, conjunctionRisk: elongation < 5 };
}

/** Unit vector (Mars body frame used by the hero globe) for a lat / east lon. */
export function latLonToVec3(lat, lonE, out = [0, 0, 0]) {
  // Matches THREE.SphereGeometry UVs with an equirectangular map spanning lon −180→180.
  const phi = (lonE + 180) * DEG;
  const cl = cos(lat);
  out[0] = -Math.cos(phi) * cl;
  out[1] = sin(lat);
  out[2] = Math.sin(phi) * cl;
  return out;
}

export function wrapLon(lon) {
  return mod(lon + 180, 360) - 180;
}

export function formatHMS(hours) {
  const h = Math.floor(hours);
  const mFloat = (hours - h) * 60;
  const mm = Math.floor(mFloat);
  const ss = Math.floor((mFloat - mm) * 60);
  const p = (v) => String(v).padStart(2, '0');
  return `${p(h)}:${p(mm)}:${p(ss)}`;
}

export function formatHM(hours) {
  return formatHMS(hours).slice(0, 5);
}
