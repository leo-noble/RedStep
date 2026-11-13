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
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
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


/* ---- Artemis II / SLS model (public/models/artemis_ii_sls.obj, Z-up, 17.35 units tall) ---- */
const MODEL_URL = '/models/artemis_ii_sls.obj';
const MODEL_H = 17.35;
// colours from the model's .mtl (diffuse), plus how metallic each region is
const MODEL_MTL = {
  // the core stage's foam insulation: a muted, burnt orange-red, not a saturated red
  orange: [0.6, 0.29, 0.15, 0.05],
  orange_light: [0.68, 0.36, 0.2, 0.05],
  white: [0.82, 0.84, 0.84, 0.0],
  white2: [0.96, 0.96, 0.92, 0.0],
  gray: [0.22, 0.25, 0.28, 0.35],
  dark: [0.055, 0.065, 0.08, 0.7],
  gold: [0.72, 0.48, 0.16, 0.85],
  blue: [0.025, 0.08, 0.55, 0.1],
  black: [0.012, 0.015, 0.02, 0.2],
  red: [0.55, 0.045, 0.035, 0.05],
};
// engine layout measured from the model (rig units: rocket length 1, engines at y = 0)
// The stack is widened to the drawn rocket's girth (WIDEN) and tapers back to the model's own
// slim nose and tower above TAPER, so it reads as a sturdy rocket with a narrow tip.
const WIDEN = 1.45;
const TAPER = [0.78, 0.93];
const MODEL_NOZZLES = [[0, 0.0317 * WIDEN], [(0.94 / MODEL_H) * WIDEN, (0.29 / MODEL_H) * WIDEN], [(-0.94 / MODEL_H) * WIDEN, (0.29 / MODEL_H) * WIDEN]];

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
void main(){
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec3 V = normalize(vV);
  vec3 albedo = vPaint.rgb;
  float metal = vPaint.a;
  float rough = mix(0.45, 0.3, metal);
  float ndl = dot(n, uSunView);
  float lit = max((ndl + 0.1) / 1.1, 0.0);
  vec3 H = normalize(uSunView + V);
  float a2 = rough * rough;
  float ndh = max(dot(n, H), 0.0);
  float dd = ndh * ndh * (a2 * a2 - 1.0) + 1.0;
  float D = (a2 * a2) / (3.14159 * dd * dd);
  vec3 F0 = mix(vec3(0.04), albedo, metal);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  vec3 spec = D * F * 0.25 * step(0.0, ndl);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(vec3(0.012, 0.016, 0.026), vec3(0.10, 0.17, 0.30), smoothstep(0.2, -0.8, R.y));
  float fres = pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 env = sky * mix(0.04 + 0.96 * fres, 1.0, metal) * (1.0 - rough * 0.6);
  vec3 bounce = uBounce * max(-n.y * 0.5 + 0.5, 0.0);
  vec3 sun = vec3(1.0, 0.97, 0.92);
  vec3 col = albedo * (1.0 - metal * 0.6) * (lit * sun * 1.3 + bounce * 1.6 + 0.04) + spec * sun * 2.2 + env;
  // the engines light the bottom of the stack
  col += albedo * vec3(1.0, 0.55, 0.22) * uThrust * 0.7 * smoothstep(0.12, 0.0, vY);
  gl_FragColor = vec4(col * uFade, uFade);
}
`;

/** Fetch and prepare the model: one merged mesh, Y-up, 1 unit long, engines at y = 0. */
async function loadModel() {
  const text = await (await fetch(MODEL_URL)).text();
  const root = new OBJLoader().parse(text);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const paint = new Float32Array(g.attributes.position.count * 4);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const c = MODEL_MTL[mats[gr.materialIndex]?.name] || MODEL_MTL.white;
      for (let v = gr.start; v < gr.start + gr.count; v++) paint.set(c, v * 4);
    }
    g.setAttribute('aPaint', new THREE.BufferAttribute(paint, 4));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'aPaint') g.deleteAttribute(k);
    g.clearGroups();
    parts.push(g);
  });
  let geo = mergeGeometries(parts);
  geo.rotateX(-Math.PI / 2); // Blender's Z-up to Y-up
  geo.scale(1 / MODEL_H, 1 / MODEL_H, 1 / MODEL_H);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.min(1, Math.max(0, (y - TAPER[0]) / (TAPER[1] - TAPER[0])));
    const f = WIDEN + (1 - WIDEN) * t * t * (3 - 2 * t);
    pos.setX(i, pos.getX(i) * f);
    pos.setZ(i, pos.getZ(i) * f);
  }
  geo = toCreasedNormals(geo, Math.PI / 5); // smooth curves, crisp edges
  return geo;
}

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
  nozzles.forEach((n, k) => {
    for (const hot of [0, 1]) {
      // a cone from the nozzle (y = 0) down to y = -1; length is scaled in the shader
      const r0 = exitR[k] * (hot ? 0.62 : 0.95);
      const r1 = exitR[k] * (hot ? 0.4 : 3.8); // the outer flame flares out behind the nozzle
      const g = new THREE.CylinderGeometry(r0, r1, 1, RAD, HSEG, true);
      g.translate(0, -0.5, 0);
      const m = new THREE.ShaderMaterial({
        vertexShader: FLAME_VERTEX,
        fragmentShader: FLAME_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uThrust: { value: 1 },
          uLen: { value: (k === 0 ? 0.68 : 0.58) * (hot ? 0.42 : 1) },
          uHot: { value: hot },
          uSeed: { value: k * 3.1 + hot * 1.7 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(n);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      body.add(mesh);
      flames.push(mesh);
      flameMats.push(m);
    }
  });

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
    uniforms: { uSunView: { value: new THREE.Vector3(0.6, 0.4, 0.7) }, uBounce: { value: new THREE.Color(0.07, 0.1, 0.16) }, uFade: { value: 1 }, uThrust: { value: 1 } },
  });
  let model = null;
  let disposed = false;
  loadModel().then((geo) => {
    if (disposed) { geo.dispose(); return; }
    model = new THREE.Mesh(geo, modelMat);
    model.frustumCulled = false;
    body.add(model);
    vehicle.visible = false;
    for (const h of legs) h.visible = false;
    // flames and glows move to the model's own engines, sized to its nozzles
    flames.forEach((f, i) => {
      const k = i >> 1;
      const [x, r] = MODEL_NOZZLES[k];
      f.position.set(x, 0, 0);
      // the outer flame flares wider than the nozzle, like a plume in thin air
      const s = (r / exitR[k]) * (i % 2 === 0 ? 1.35 : 1);
      f.scale.set(s, 1, s);
    });
    const gp = glowGeo.attributes.position;
    MODEL_NOZZLES.forEach(([x], k) => gp.setX(k, x));
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
      for (const f of flames) f.visible = thrust * fade > 0.01;
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
