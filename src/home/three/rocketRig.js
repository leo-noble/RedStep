/* ==========================================================================
   Rocket rig
   A solid white heavy-lift rocket (core stage, black interstage band, nose
   fairing, two side boosters, three engine bells) drawn in one mesh with a
   painted shader with self-shadowing, a turbulent flame mesh per engine, soft smoke behind the
   flames and a glow at each nozzle.
   Local units: rocket length = 1, engines at y = 0, nose at y = 1.
   ========================================================================== */

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROCKET_VERTEX, ROCKET_FRAGMENT, FLAME_VERTEX, FLAME_FRAGMENT, SMOKE_VERTEX, SMOKE_FRAGMENT, GLOW_VERTEX, GLOW_FRAGMENT } from './shaders.js';

const CORE_R = 0.05;
const BOOST_R = 0.031;
const BOOST_X = CORE_R + BOOST_R + 0.006;

// Radius profiles (null = no hull at this height)
function coreProfile(y) {
  if (y < 0.045) return null;
  if (y < 0.86) return CORE_R;
  const t = (y - 0.86) / 0.14;
  return CORE_R * 1.03 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.1)), 0.56);
}
function boosterProfile(y) {
  if (y < 0.05 || y > 0.6) return null;
  if (y < 0.5) return BOOST_R;
  const t = (y - 0.5) / 0.1;
  return BOOST_R * Math.pow(Math.max(0, 1 - Math.pow(t, 1.8)), 0.6);
}
function bellProfile(y, top, bottomR, topR) {
  if (y > top || y < 0) return null;
  return topR + (bottomR - topR) * (1 - y / top);
}

/** Surface of revolution from a radius profile, closed at the bottom, tagged with its part. */
function lathe(profile, y0, y1, step, segments, cx, part, { closeBottom = true } = {}) {
  const pts = [];
  if (closeBottom) pts.push(new THREE.Vector2(0, y0));
  for (let y = y0; y <= y1 + 1e-6; y += step) {
    const r = profile(y);
    if (r != null) pts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const g = new THREE.LatheGeometry(pts, segments);
  g.translate(cx, 0, 0);
  return tag(g, part);
}

function tag(g, part) {
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
  return g;
}

/** "REDSTEP" lettering, drawn once into a small texture (redrawn when the font arrives). */
function letteringTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  const draw = () => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    ctx.font = '700 84px "Syne", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '14px';
    ctx.fillText('REDSTEP', c.width / 2, c.height / 2 + 4);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('700 84px "Syne"').then(draw, () => {});
  return tex;
}


/* ---- The concept rocket, built in code (matches the reference image) ----
   Units: length 1, engines at y = 0, nose at y = 1, axis along y.
     · upper stage: dark gunmetal, ogive nose with crew windows, two pairs of fins
     · lower core: silver-white with a blue roundel, a flared engine skirt
     · four slim strap-on boosters, two big swept delta fins at the base
     · nine engine bells: a ring of six round a centre one, and one under each fin */
const PAINT = {
  dark: [0.15, 0.17, 0.2, 0.75], // gunmetal stainless
  steel: [0.5, 0.53, 0.57, 0.7],
  white: [0.86, 0.87, 0.89, 0.12],
  panel: [0.2, 0.22, 0.25, 0.5],
  glass: [0.02, 0.03, 0.05, 0.4],
  blue: [0.06, 0.2, 0.62, 0.1],
  bell: [0.32, 0.33, 0.35, 0.85],
  bellIn: [0.05, 0.05, 0.06, 0.5],
};
const R_CORE = 0.064;
// nine engine bells: a ring of six round a centre one, plus one under each delta fin;
// each gets its own flame (exit radius BELL_R)
const BELLS = [[0, 0], ...Array.from({ length: 6 }, (_, k) => [0.052 * Math.cos((k * Math.PI) / 3 + Math.PI / 6), 0.052 * Math.sin((k * Math.PI) / 3 + Math.PI / 6)]), [0.2, 0], [-0.2, 0]];
const BELL_R = 0.022;

function painted(geo, color) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const c = new Float32Array(g.attributes.position.count * 4);
  for (let i = 0; i < g.attributes.position.count; i++) c.set(color, i * 4);
  g.setAttribute('aPaint', new THREE.BufferAttribute(c, 4));
  return g;
}
const latheOf = (pts, seg = 128) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** A flat fin from a 2D outline (x outward from the hull, y up), thickness t, set at angle a. */
function fin(outline, t, y0, a, color) {
  const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  // rounded edges all round (a bevel half the thickness), so fins read as moulded, not cut
  const b = t * 0.45;
  const g = new THREE.ExtrudeGeometry(sh, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelOffset: -b * 0.9, bevelSegments: 5, curveSegments: 1 });
  g.translate(R_CORE - 0.004, y0, -(t - 2 * b) / 2);
  g.rotateY(a);
  return painted(g, color);
}

async function buildModel() {
  const parts = [];
  const add = (g, c) => parts.push(painted(g, c));
  // lower core, silver-white: flared skirt at the base, slim above
  add(latheOf([[0, 0.06], [0.088, 0.06], [0.086, 0.09], [0.074, 0.15], [0.067, 0.3], [R_CORE, 0.45], [R_CORE, 0.63]]), PAINT.white);
  // a thin steel ring at the stage joint
  add(latheOf([[R_CORE + 0.0015, 0.625], [R_CORE + 0.0015, 0.64]]), PAINT.steel);
  // upper stage, dark: straight body, then an ogive nose
  const up = [[R_CORE, 0.63], [R_CORE - 0.002, 0.86]];
  for (let k = 1; k <= 40; k++) {
    const t = k / 40;
    up.push([(R_CORE - 0.002) * Math.pow(1 - Math.pow(t, 2.2), 0.62), 0.86 + t * 0.14]);
  }
  add(latheOf(up), PAINT.dark);
  // crew windows: a row of small dark panes on the nose
  for (const ang of [-0.5, -0.17, 0.17, 0.5]) {
    const w = new THREE.CapsuleGeometry(0.0045, 0.007, 6, 16);
    w.scale(1, 1, 0.45);
    w.translate(0, 0.905, R_CORE * 0.93);
    w.rotateY(ang);
    parts.push(painted(w, PAINT.glass));
  }
  // blue roundel on the white core (an emblem, not an agency logo)
  const disc = new THREE.CircleGeometry(0.021, 96);
  disc.translate(0, 0.53, R_CORE + 0.0012);
  parts.push(painted(disc, PAINT.blue));
  // fins on the upper stage: small forward pair, larger pair lower down (left and right)
  for (const a of [0, Math.PI]) {
    parts.push(fin([[0, 0], [0.055, 0.02], [0.055, 0.075], [0.012, 0.11], [0, 0.11]], 0.006, 0.78, a, PAINT.steel));
    parts.push(fin([[0, 0], [0.062, 0.018], [0.062, 0.1], [0.014, 0.142], [0, 0.142]], 0.007, 0.595, a, PAINT.steel));
  }
  // big swept delta fins at the base, white with a dark trailing panel
  for (const a of [0, Math.PI]) {
    parts.push(fin([[0, 0.38], [0.17, 0.07], [0.17, -0.01], [0, 0.0]], 0.009, 0.06, a, PAINT.white));
    parts.push(fin([[0.12, 0.09], [0.172, 0.06], [0.172, 0.0], [0.12, 0.0]], 0.0105, 0.06, a, PAINT.panel));
  }
  // four slim strap-on boosters with pointed noses
  for (const a of [0.85, Math.PI - 0.85, Math.PI + 0.85, -0.85]) {
    const prof = [[0, 0.07], [0.02, 0.07], [0.02, 0.38]];
    for (let k = 1; k <= 24; k++) { const t = k / 24; prof.push([0.02 * Math.pow(1 - t * t, 0.6), 0.38 + t * 0.07]); }
    const g = latheOf(prof, 72);
    g.translate(R_CORE + 0.016, 0, 0);
    g.rotateY(a);
    parts.push(painted(g, a > 0 && a < Math.PI ? PAINT.white : PAINT.dark));
  }
  // engine bells: a ring of six round a centre one, plus one under each delta fin
  for (const [x, z] of BELLS) {
    const outer = latheOf([[0.024, 0], [0.0215, 0.012], [0.019, 0.025], [0.0155, 0.04], [0.012, 0.055], [0.01, 0.065]], 64);
    outer.translate(x, 0, z);
    parts.push(painted(outer, PAINT.bell));
    const inner = latheOf([[0.0225, 0.002], [0.017, 0.025], [0.011, 0.05]], 64);
    inner.translate(x, 0, z);
    parts.push(painted(inner, PAINT.bellIn));
  }
  let geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  geo = toCreasedNormals(geo, (50 * Math.PI) / 180); // smooth hulls and fin bevels, crisp true corners
  return geo;
}

const MODEL_VERTEX = /* glsl */ `
attribute vec4 aPaint;
varying vec3 vN;
varying vec3 vV;
varying vec4 vPaint;
varying float vY;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vPaint = aPaint;
  vY = position.y;
  gl_Position = projectionMatrix * mv;
}
`;
const MODEL_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uSunView;
uniform vec3 uBounce;
uniform float uFade;
uniform float uThrust;
varying vec3 vN;
varying vec3 vV;
varying vec4 vPaint;
varying float vY;

// A soft studio around the rocket, in view space: dark space below, a cool sky above, and two
// tall softboxes, so glossy paint shows long, clean highlights down the round hull.
// w widens the softboxes: 1 for the glassy coat, larger for a blurred satin reflection
vec3 studio(vec3 R, float w){
  vec3 c = mix(vec3(0.01, 0.012, 0.018), vec3(0.11, 0.14, 0.2), smoothstep(-0.35, 0.9, R.y));
  float tall = smoothstep(-0.55, 0.15, R.y) * (1.0 - smoothstep(0.75, 1.0, R.y));
  c += vec3(1.0, 0.97, 0.93) * (1.35 / w) * exp(-pow((R.x - 0.52) / (0.13 * w), 2.0)) * tall;
  c += vec3(0.55, 0.66, 0.85) * (0.55 / w) * exp(-pow((R.x + 0.66) / (0.1 * w), 2.0)) * tall;
  c += vec3(1.0, 0.97, 0.9) * pow(max(dot(R, uSunView), 0.0), 400.0 / (w * w)) * (8.0 / (w * w));
  return c;
}

float ggx(float ndh, float a){ float a2 = a * a; float d = ndh * ndh * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }

void main(){
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec3 V = normalize(vV);
  vec3 albedo = vPaint.rgb;
  float metal = vPaint.a;
  float NdV = max(dot(n, V), 1e-3);
  vec3 R = reflect(-V, n);
  vec3 H = normalize(uSunView + V);
  float ndl = dot(n, uSunView);
  float ndh = max(dot(n, H), 0.0);
  float vdh = max(dot(V, H), 0.0);
  vec3 sun = vec3(1.0, 0.97, 0.92);

  // base layer: painted (dielectric) or bare metal
  float rough = mix(0.5, 0.22, metal);
  float lit = max((ndl + 0.08) / 1.08, 0.0);
  vec3 F0 = mix(vec3(0.04), albedo, metal);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - vdh, 5.0);
  vec3 baseSpec = ggx(ndh, rough * rough) * F * 0.25 * step(0.0, ndl) * sun * 2.0;
  vec3 bounce = uBounce * max(-n.y * 0.5 + 0.5, 0.0);
  // form shading: a round hull falls off smoothly toward its edges, so it reads as a cylinder
  float form = mix(0.5, 1.0, pow(NdV, 0.6));
  vec3 diffuse = albedo * (1.0 - metal) * (lit * sun * 1.15 + bounce * 1.5 + 0.035) * form;
  vec3 metalEnv = studio(R, 2.5) * albedo * metal * 1.1;

  // Glassy clear coat on the dark panels only (the gunmetal upper stage, dark boosters and
  // fin panels); the white metal keeps a soft satin sheen, not a mirror.
  float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
  float coatAmt = 1.0 - smoothstep(0.3, 0.6, lum);
  float Fc = (0.04 + 0.96 * pow(1.0 - NdV, 5.0)) * coatAmt;
  vec3 coat = (studio(R, 1.0) * mix(0.09, 1.0, Fc) * 0.85
            + ggx(ndh, 0.035 * 0.035) * (0.04 + 0.96 * pow(1.0 - vdh, 5.0)) * 0.25 * step(0.0, ndl) * sun * 1.5) * coatAmt;
  // satin sheen for the white metal: a broad, faint reflection of the same studio
  vec3 satin = studio(R, 3.5) * (0.05 + 0.2 * pow(1.0 - NdV, 3.0)) * (1.0 - coatAmt) * 0.7;
  vec3 col = (diffuse + baseSpec + metalEnv) * (1.0 - Fc * 0.85) + coat + satin;

  // the engines light the bottom of the stack
  col += albedo * vec3(1.0, 0.55, 0.22) * uThrust * 0.6 * smoothstep(0.12, 0.0, vY);
  // gentle shoulder so the brightest highlights roll off instead of clipping flat
  col = col / (1.0 + max(col - 0.85, 0.0) * 0.6);
  gl_FragColor = vec4(col * uFade, uFade);
}
`;

export function createRocketRig({ quality = 'high' } = {}) {
  const low = quality === 'low';
  const group = new THREE.Group();
  group.name = 'rocket';
  const body = new THREE.Group(); // rolls about its long axis
  body.position.y = -0.5; // pivot at mid-length
  group.add(body);

  /* ---- Vehicle ---- */
  const SEG = low ? 64 : 96; // round, smooth hull on every device
  const parts = [
    lathe(coreProfile, 0.045, 1.0, 0.004, SEG, 0, 0),
    lathe(boosterProfile, 0.05, 0.6, 0.004, Math.round(SEG * 0.75), BOOST_X, 1),
    lathe(boosterProfile, 0.05, 0.6, 0.004, Math.round(SEG * 0.75), -BOOST_X, 1),
    lathe((y) => bellProfile(y, 0.045, CORE_R * 0.78, CORE_R * 0.42), 0, 0.045, 0.003, SEG, 0, 2, { closeBottom: false }),
    lathe((y) => bellProfile(y, 0.05, BOOST_R * 0.82, BOOST_R * 0.45), 0, 0.05, 0.003, Math.round(SEG * 0.6), BOOST_X, 2, { closeBottom: false }),
    lathe((y) => bellProfile(y, 0.05, BOOST_R * 0.82, BOOST_R * 0.45), 0, 0.05, 0.003, Math.round(SEG * 0.6), -BOOST_X, 2, { closeBottom: false }),
  ];
  // booster attach struts
  for (const sx of [1, -1]) {
    for (const y of [0.16, 0.46]) {
      const len = BOOST_X - BOOST_R - CORE_R + 0.004;
      const g = new THREE.CylinderGeometry(0.0032, 0.0032, len, 8);
      g.rotateZ(Math.PI / 2);
      g.translate(sx * (CORE_R + len / 2 - 0.002), y, 0);
      parts.push(tag(g, 3));
    }
  }
  for (const g of parts) g.deleteAttribute('uv');
  const vehicleGeo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of parts) g.dispose();

  const text = letteringTexture();
  const vehicleMat = new THREE.ShaderMaterial({
    vertexShader: ROCKET_VERTEX,
    fragmentShader: ROCKET_FRAGMENT,
    uniforms: {
      uSunView: { value: new THREE.Vector3(0.6, 0.4, 0.7).normalize() },
      uSunObj: { value: new THREE.Vector3(0.6, 0.4, 0.7).normalize() },
      uBoostR: { value: BOOST_R },
      uFade: { value: 1 },
      uThrust: { value: 1 },
      uText: { value: text },
      uCoreR: { value: CORE_R },
      uBoostX: { value: BOOST_X },
      uBounce: { value: new THREE.Color(0.07, 0.1, 0.16) },
    },
    side: THREE.DoubleSide, // the bells are open cones
  });
  const vehicle = new THREE.Mesh(vehicleGeo, vehicleMat);
  vehicle.frustumCulled = false;
  body.add(vehicle);

  /* ---- Landing legs: four struts folded flat against the core, swung out for touchdown ---- */
  const legGeo = tag(new THREE.BoxGeometry(0.009, 0.15, 0.005), 4);
  legGeo.translate(0, 0.075, 0); // hinge at the bottom end
  legGeo.deleteAttribute('uv');
  const footGeo = tag(new THREE.CylinderGeometry(0.009, 0.011, 0.004, 12), 4);
  footGeo.deleteAttribute('uv');
  const legs = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2; // between the boosters
    const hinge = new THREE.Group();
    hinge.position.set(Math.cos(a) * (CORE_R + 0.003), 0.055, Math.sin(a) * (CORE_R + 0.003));
    hinge.rotation.y = -a; // local +x points radially outward
    const leg = new THREE.Mesh(legGeo, vehicleMat);
    leg.frustumCulled = false;
    const foot = new THREE.Mesh(footGeo, vehicleMat);
    foot.position.y = 0.15;
    foot.frustumCulled = false;
    leg.add(foot);
    hinge.add(leg);
    body.add(hinge);
    legs.push(hinge);
  }
  const setLegs = (d) => {
    // folded: pointing up along the hull; deployed: swung ~150° down and outward
    for (const h of legs) h.rotation.z = -d * 2.55;
  };
  setLegs(0);

  /* ---- Flames: an inner white-hot core and an outer turbulent flame per engine ---- */
  const nozzles = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(BOOST_X, 0, 0), new THREE.Vector3(-BOOST_X, 0, 0)];
  const exitR = [CORE_R * 0.74, BOOST_R * 0.8, BOOST_R * 0.8];
  const flames = [];
  const flameMats = [];
  const RAD = low ? 18 : 36;
  const HSEG = low ? 12 : 28;
  /** One engine's flame: a white-hot inner cone inside a flaring outer one. */
  function addFlame(pos, r, lenScale, seed) {
    for (const hot of [0, 1]) {
      // a cone from the nozzle (y = 0) down to y = -1; length is scaled in the shader
      const r0 = r * (hot ? 0.62 : 0.95);
      const r1 = r * (hot ? 0.4 : 3.8); // the outer flame flares out behind the nozzle
      const g = new THREE.CylinderGeometry(r0, r1, 1, RAD, HSEG, true);
      g.translate(0, -0.5, 0);
      const m = new THREE.ShaderMaterial({
        vertexShader: FLAME_VERTEX,
        fragmentShader: FLAME_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uThrust: { value: 1 },
          uLen: { value: lenScale * (hot ? 0.42 : 1) },
          uHot: { value: hot },
          uSeed: { value: seed + hot * 1.7 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(pos);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      body.add(mesh);
      flames.push(mesh);
      flameMats.push(m);
    }
  }
  nozzles.forEach((n, k) => addFlame(n, exitR[k], k === 0 ? 0.68 : 0.58, k * 3.1));

  /* ---- Smoke: soft puffs that billow out where the flames thin ---- */
  const COUNT = low ? 1200 : 3200;
  const aNozzle = new Float32Array(COUNT);
  const aSeed = new Float32Array(COUNT * 4);
  const pos = new Float32Array(COUNT * 3);
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) {
    const r = rnd();
    aNozzle[i] = r < 0.46 ? 0 : r < 0.73 ? 1 : 2;
    aSeed[i * 4] = rnd();
    aSeed[i * 4 + 1] = rnd();
    aSeed[i * 4 + 2] = rnd();
    aSeed[i * 4 + 3] = rnd();
  }
  const plumeGeo = new THREE.BufferGeometry();
  plumeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  plumeGeo.setAttribute('aNozzle', new THREE.BufferAttribute(aNozzle, 1));
  plumeGeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 4));
  const plumeMat = new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERTEX,
    fragmentShader: SMOKE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uThrust: { value: 1 },
      uLen: { value: 2.2 }, // trail length in rocket lengths
      uPx: { value: 1000 },
      uNozzle: { value: nozzles },
      uNozzleR: { value: exitR },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const plume = new THREE.Points(plumeGeo, plumeMat);
  plume.frustumCulled = false;
  plume.renderOrder = 1; // smoke first, the flames glow over it
  body.add(plume); // plume rolls with the body, matching nozzle positions

  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, -0.01, 0, BOOST_X, -0.008, 0, -BOOST_X, -0.008, 0], 3),
  );
  glowGeo.setAttribute('aSize', new THREE.Float32BufferAttribute([0.2, 0.13, 0.13], 1));
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms: { uPx: { value: 1000 }, uThrust: { value: 1 }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Points(glowGeo, glowMat);
  glow.frustumCulled = false;
  glow.renderOrder = 2;
  body.add(glow);

  const tmpV = new THREE.Vector3();
  const tmpM = new THREE.Matrix3();
  const tmpInv = new THREE.Matrix4();

  /* ---- swap in the Artemis II model once it has loaded (the drawn rocket is the fallback) ---- */
  const modelMat = new THREE.ShaderMaterial({
    vertexShader: MODEL_VERTEX,
    fragmentShader: MODEL_FRAGMENT,
    side: THREE.DoubleSide, // open engine bells show their insides
    uniforms: { uSunView: { value: new THREE.Vector3(0.6, 0.4, 0.7) }, uBounce: { value: new THREE.Color(0.07, 0.1, 0.16) }, uFade: { value: 1 }, uThrust: { value: 1 } },
  });
  let model = null;
  let disposed = false;
  buildModel().then((geo) => {
    if (disposed) { geo.dispose(); return; }
    model = new THREE.Mesh(geo, modelMat);
    model.frustumCulled = false;
    body.add(model);
    vehicle.visible = false;
    for (const h of legs) h.visible = false;
    // the drawn rocket's three flames go out; each of the model's nine bells gets its own
    for (const f of flames) f.userData.off = true;
    BELLS.forEach(([x, z], k) => addFlame(new THREE.Vector3(x, 0, z), BELL_R, k === 0 ? 0.6 : 0.52, 10 + k * 2.3));
    // nozzle glows: one at the cluster centre, one at each outer bell
    const gp = glowGeo.attributes.position;
    gp.setXYZ(0, 0, -0.01, 0);
    gp.setXYZ(1, BELLS[7][0], -0.008, 0);
    gp.setXYZ(2, BELLS[8][0], -0.008, 0);
    gp.needsUpdate = true;
  }).catch(() => { /* keep the drawn rocket */ });

  return {
    group,
    vehicleMat,
    body,
    stats: { triangles: vehicleGeo.attributes.position.count / 3, particles: COUNT, flames: flames.length },
    /** Slow device: draw fewer smoke puffs (level 1: half, 2: a quarter) instead of a blurrier frame. */
    lighten(level) {
      plumeGeo.setDrawRange(0, Math.round(COUNT / 2 ** level))
    },
    /** Per-frame uniform writes only. */
    update({ time, thrust, px, fade, sunWorld, camera, smoke = 1, legs: legDeploy = 0, bounce }) {
      setLegs(legDeploy);
      if (bounce) vehicleMat.uniforms.uBounce.value.copy(bounce);
      plumeMat.uniforms.uTime.value = time;
      plumeMat.uniforms.uThrust.value = Math.min(1, thrust) * fade * smoke;
      plume.visible = smoke > 0.01;
      plumeMat.uniforms.uPx.value = px;
      for (const m of flameMats) {
        m.uniforms.uTime.value = time;
        m.uniforms.uThrust.value = thrust * fade;
      }
      for (const f of flames) f.visible = !f.userData.off && thrust * fade > 0.01;
      glowMat.uniforms.uTime.value = time;
      glowMat.uniforms.uThrust.value = thrust;
      glowMat.uniforms.uPx.value = px;
      vehicleMat.uniforms.uFade.value = fade;
      modelMat.uniforms.uFade.value = fade;
      modelMat.uniforms.uThrust.value = thrust;
      modelMat.transparent = fade < 0.999;
      if (bounce) modelMat.uniforms.uBounce.value.copy(bounce);
      vehicleMat.uniforms.uThrust.value = thrust;
      // opaque once fully in; blended only while fading in or out
      vehicleMat.transparent = fade < 0.999;
      // sun in view space for the paint shading
      tmpM.setFromMatrix4(camera.matrixWorldInverse);
      vehicleMat.uniforms.uSunView.value.copy(tmpV.copy(sunWorld).applyMatrix3(tmpM).normalize());
      modelMat.uniforms.uSunView.value.copy(tmpV);
      // and in the vehicle's own frame, for the shadows it casts on itself
      tmpInv.copy(vehicle.matrixWorld).invert();
      vehicleMat.uniforms.uSunObj.value.copy(sunWorld).transformDirection(tmpInv);
    },
    dispose() {
      disposed = true;
      model?.geometry.dispose();
      modelMat.dispose();
      vehicleGeo.dispose();
      legGeo.dispose();
      footGeo.dispose();
      vehicleMat.dispose();
      text.dispose();
      plumeGeo.dispose();
      glowGeo.dispose();
      plumeMat.dispose();
      for (const f of flames) f.geometry.dispose();
      for (const m of flameMats) m.dispose();
      glowMat.dispose();
    },
  };
}
