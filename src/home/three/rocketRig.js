/* ==========================================================================
   Dot-to-dot rocket rig
   The reference rocket (core stage + interstage band + fairing + two side
   boosters, three engines) is rebuilt as a hex-offset lattice of instanced
   dots joined by hairline connectors, plus a fading particle plume.
   Local units: rocket length = 1, engines at y = 0, nose at y = 1.
   ========================================================================== */

import * as THREE from 'three';
import {
  DOT_VERTEX,
  DOT_FRAGMENT,
  WIRE_VERTEX,
  WIRE_FRAGMENT,
  HULL_VERTEX,
  HULL_FRAGMENT,
  PLUME_VERTEX,
  PLUME_FRAGMENT,
  GLOW_VERTEX,
  GLOW_FRAGMENT,
} from './shaders.js';

const HULL = [0.945, 0.922, 0.898]; // #f1ebe5
const ICE = [0.5, 0.69, 1.0]; // #7fb0ff
const EMBER = [1.0, 0.698, 0.357]; // #ffb25b
const SPACING = 0.0092;

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

// Paint: interstage + booster skirts are black in the reference → dim ice dots.
const corePaint = (y) => (y > 0.7 && y < 0.765 ? 'band' : y > 0.96 ? 'tip' : 'hull');
const boosterPaint = (y) => (y < 0.2 ? 'band' : 'hull');

function sampleBody({ profile, paint, cx = 0, cz = 0, y0, y1, dots, normals, colors, sizes, rings }) {
  const dy = SPACING * 0.92;
  let k = 0;
  for (let y = y0; y <= y1 + 1e-6; y += dy, k++) {
    const r = profile(y);
    if (r == null || r < 0.002) {
      if (r != null && r < 0.002) {
        // single nose dot
        dots.push(cx, y, cz);
        normals.push(0, 1, 0);
        colors.push(...HULL);
        sizes.push(1.35);
      }
      continue;
    }
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / SPACING));
    const rPrev = profile(y - dy) ?? r;
    const rNext = profile(y + dy) ?? r;
    const slope = (rNext - rPrev) / (2 * dy);
    const ring = { start: dots.length / 3, n, y };
    const kind = paint(y);
    for (let j = 0; j < n; j++) {
      const a = ((j + (k % 2) * 0.5) / n) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      dots.push(cx + c * r, y, cz + s * r);
      const nv = new THREE.Vector3(c, -slope, s).normalize();
      normals.push(nv.x, nv.y, nv.z);
      if (kind === 'band') {
        colors.push(ICE[0] * 0.42, ICE[1] * 0.42, ICE[2] * 0.42);
        sizes.push(0.85);
      } else if (kind === 'tip') {
        colors.push(1, 1, 1);
        sizes.push(1.2);
      } else {
        colors.push(...HULL);
        sizes.push(1);
      }
    }
    rings.push(ring);
  }
}

function sampleBell({ cx, cz, top, bottomR, topR, dots, normals, colors, sizes, rings }) {
  const dy = SPACING * 0.8;
  let k = 0;
  for (let y = 0; y <= top; y += dy, k++) {
    const r = bellProfile(y, top, bottomR, topR);
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / (SPACING * 0.9)));
    const ring = { start: dots.length / 3, n, y };
    const heat = 1 - y / top;
    for (let j = 0; j < n; j++) {
      const a = ((j + (k % 2) * 0.5) / n) * Math.PI * 2;
      dots.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      normals.push(Math.cos(a), -0.4, Math.sin(a));
      colors.push(
        HULL[0] * (1 - heat) + EMBER[0] * heat,
        HULL[1] * (1 - heat) + EMBER[1] * heat,
        HULL[2] * (1 - heat) + EMBER[2] * heat,
      );
      sizes.push(0.9);
    }
    rings.push(ring);
  }
}

/** Connect each ring to the next (stringers) and every 3rd ring around (hoops). */
function connect(rings, dots, normals, out, outN, outA) {
  const P = (i) => [dots[i * 3], dots[i * 3 + 1], dots[i * 3 + 2]];
  const N = (i) => [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
  const push = (i, j, alpha) => {
    out.push(...P(i), ...P(j));
    outN.push(...N(i), ...N(j));
    outA.push(alpha, alpha);
  };
  for (let r = 0; r < rings.length; r++) {
    const a = rings[r];
    if (r % 3 === 0) {
      for (let j = 0; j < a.n; j++) push(a.start + j, a.start + ((j + 1) % a.n), 0.34);
    }
    const b = rings[r + 1];
    if (!b || Math.abs(b.y - a.y) > SPACING * 1.5) continue;
    for (let j = 0; j < a.n; j++) {
      const t = j / a.n;
      const jb = Math.round(t * b.n) % b.n;
      const spine = j % 4 === 0;
      push(a.start + j, b.start + jb, spine ? 0.5 : 0.2);
    }
  }
}

/* Solid inner hull: a softly lit body just inside the dots. It hides the far side's dots, so
   the rocket reads as one solid white vehicle drawn in dots instead of a see-through net. */
function hullGeometry(profile, paint, cx, y0, y1) {
  const pts = [];
  for (let y = y0; y <= y1 + 1e-6; y += SPACING * 0.5) {
    const r = profile(y);
    if (r != null) pts.push(new THREE.Vector2(Math.max(0, r * 0.955), y));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const kind = paint ? paint(pos.getY(i)) : 'hull';
    const c = kind === 'band' ? [0.06, 0.08, 0.11] : kind === 'bell' ? [0.16, 0.13, 0.11] : [0.62, 0.61, 0.6];
    col.set(c, i * 3);
  }
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.translate(cx, 0, 0);
  return g;
}

function dotMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: DOT_VERTEX,
    fragmentShader: DOT_FRAGMENT,
    uniforms: {
      uPx: { value: 1000 },
      uDot: { value: 0.0105 },
      uSunView: { value: new THREE.Vector3(0.6, 0.4, 0.7).normalize() },
      uFade: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createRocketRig() {
  const group = new THREE.Group();
  group.name = 'rocket';
  const body = new THREE.Group(); // rolls about its long axis
  body.position.y = -0.5; // pivot at mid-length
  group.add(body);

  const dots = [];
  const normals = [];
  const colors = [];
  const sizes = [];
  const lines = [];
  const lineN = [];
  const lineA = [];

  const parts = [
    { kind: 'body', profile: coreProfile, paint: corePaint, cx: 0, cz: 0, y0: 0.045, y1: 1.0 },
    { kind: 'body', profile: boosterProfile, paint: boosterPaint, cx: BOOST_X, cz: 0, y0: 0.05, y1: 0.6 },
    { kind: 'body', profile: boosterProfile, paint: boosterPaint, cx: -BOOST_X, cz: 0, y0: 0.05, y1: 0.6 },
    { kind: 'bell', cx: 0, cz: 0, top: 0.045, bottomR: CORE_R * 0.78, topR: CORE_R * 0.42 },
    { kind: 'bell', cx: BOOST_X, cz: 0, top: 0.05, bottomR: BOOST_R * 0.82, topR: BOOST_R * 0.45 },
    { kind: 'bell', cx: -BOOST_X, cz: 0, top: 0.05, bottomR: BOOST_R * 0.82, topR: BOOST_R * 0.45 },
  ];

  const hullMat = new THREE.ShaderMaterial({
    vertexShader: HULL_VERTEX,
    fragmentShader: HULL_FRAGMENT,
    uniforms: { uSunView: { value: new THREE.Vector3(0.6, 0.4, 0.7).normalize() }, uFade: { value: 1 } },
    transparent: true,
    side: THREE.DoubleSide,
  });
  const hullGeos = [];
  for (const part of parts) {
    const g =
      part.kind === 'body'
        ? hullGeometry(part.profile, part.paint, part.cx, part.y0, part.y1)
        : hullGeometry((y) => bellProfile(y, part.top, part.bottomR, part.topR), () => 'bell', part.cx, 0, part.top);
    hullGeos.push(g);
    const mesh = new THREE.Mesh(g, hullMat);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    body.add(mesh);
  }

  for (const part of parts) {
    const rings = [];
    if (part.kind === 'body') sampleBody({ ...part, dots, normals, colors, sizes, rings });
    else sampleBell({ ...part, dots, normals, colors, sizes, rings });
    connect(rings, dots, normals, lines, lineN, lineA);
  }

  // Booster attach struts (hairline only)
  for (const sx of [1, -1]) {
    for (const y of [0.16, 0.46]) {
      lines.push(sx * CORE_R, y, 0, sx * (BOOST_X - BOOST_R), y, 0);
      lineN.push(0, 0, 1, 0, 0, 1);
      lineA.push(0.6, 0.6);
    }
  }

  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  dotGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  dotGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  dotGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  const dotMat = dotMaterial();
  hullMat.uniforms.uSunView = dotMat.uniforms.uSunView; // one sun direction for both
  const points = new THREE.Points(dotGeo, dotMat);
  points.renderOrder = 2;
  points.frustumCulled = false;
  body.add(points);

  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  wireGeo.setAttribute('normal', new THREE.Float32BufferAttribute(lineN, 3));
  wireGeo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(lineA, 1));
  const wireMat = new THREE.ShaderMaterial({
    vertexShader: WIRE_VERTEX,
    fragmentShader: WIRE_FRAGMENT,
    uniforms: { uColor: { value: new THREE.Color(0.5, 0.56, 0.68) }, uFade: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wires = new THREE.LineSegments(wireGeo, wireMat);
  wires.renderOrder = 2;
  wires.frustumCulled = false;
  body.add(wires);

  /* ---- Plume ---- */
  const COUNT = 5200;
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
  const nozzles = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(BOOST_X, 0, 0), new THREE.Vector3(-BOOST_X, 0, 0)];
  const plumeMat = new THREE.ShaderMaterial({
    vertexShader: PLUME_VERTEX,
    fragmentShader: PLUME_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uThrust: { value: 1 },
      uLen: { value: 1.05 },
      uPx: { value: 1000 },
      uNozzle: { value: nozzles },
      uNozzleR: { value: [CORE_R * 0.75, BOOST_R * 0.8, BOOST_R * 0.8] },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const plume = new THREE.Points(plumeGeo, plumeMat);
  plume.frustumCulled = false;
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
  body.add(glow);

  const tmpV = new THREE.Vector3();
  const tmpM = new THREE.Matrix3();

  return {
    group,
    body,
    stats: { dots: dots.length / 3, segments: lines.length / 6, particles: COUNT },
    /** Per-frame uniform writes only. */
    update({ time, thrust, px, fade, sunWorld, camera }) {
      plumeMat.uniforms.uTime.value = time;
      plumeMat.uniforms.uThrust.value = thrust;
      plumeMat.uniforms.uPx.value = px;
      glowMat.uniforms.uTime.value = time;
      glowMat.uniforms.uThrust.value = thrust;
      glowMat.uniforms.uPx.value = px;
      dotMat.uniforms.uPx.value = px;
      dotMat.uniforms.uFade.value = fade;
      wireMat.uniforms.uFade.value = fade;
      hullMat.uniforms.uFade.value = fade;
      // sun in view space for dot lighting
      tmpM.setFromMatrix4(camera.matrixWorldInverse);
      dotMat.uniforms.uSunView.value.copy(tmpV.copy(sunWorld).applyMatrix3(tmpM).normalize());
    },
    dispose() {
      dotGeo.dispose();
      for (const g of hullGeos) g.dispose();
      hullMat.dispose();
      wireGeo.dispose();
      plumeGeo.dispose();
      glowGeo.dispose();
      dotMat.dispose();
      wireMat.dispose();
      plumeMat.dispose();
      glowMat.dispose();
    },
  };
}
