// The Marswalk rocket for the flight to Mars on the home page: a white heavy-lift rocket with a
// black band under the nose fairing and two strap-on boosters with dark lower halves, firing
// three engines. Built from smooth turned shapes with painted panels and the MARSWALK name.
// Animated: flickering flames, streaming exhaust smoke, engine shake, booster separation.
// Local units: rocket length 1, engines at y = 0, nose at y = 1. Illustrative, not to scale.
import * as THREE from 'three'

const R = 0.05 // core radius
const BR = 0.031 // booster radius
const BX = R + BR + 0.004 // booster offset from the core axis

// ---------- painted textures ----------
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  paint(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const speckle = (g, w, h, n, a) => {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 3) }
}

// Core stage (v from the engines up to the top of the cylinder): white panels, black band,
// a cable raceway and the MARSWALK name running up both sides.
const coreTex = (y0, y1, band0, band1) => canvasTex(1024, 2048, (g, w, h) => {
  const v = (y) => h - ((y - y0) / (y1 - y0)) * h // height on the rocket -> canvas row
  g.fillStyle = '#eeedea'; g.fillRect(0, 0, w, h)
  speckle(g, w, h, 6000, 0.03)
  g.fillStyle = 'rgba(70,70,76,0.22)'
  for (const y of [0.12, 0.22, 0.34, 0.46, 0.56, 0.7, 0.76]) g.fillRect(0, v(y), w, 2)
  for (let x = 0; x < w; x += w / 12) g.fillRect(x, 0, 1.4, h)
  // black band under the fairing
  g.fillStyle = '#121214'; g.fillRect(0, v(band1), w, v(band0) - v(band1))
  g.fillStyle = 'rgba(255,255,255,0.06)'
  for (let x = 0; x < w; x += 10) g.fillRect(x, v(band1), 2, v(band0) - v(band1))
  // cable raceway
  g.fillStyle = '#d9d8d4'; g.fillRect(w * 0.5 - 6, 0, 12, v(band0))
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(w * 0.5 - 7, 0, 1.5, v(band0)); g.fillRect(w * 0.5 + 6, 0, 1.5, v(band0))
  // MARSWALK, letters stacked up the side (twice, so it shows from either side)
  g.fillStyle = '#16161a'
  g.font = '700 118px Montserrat, system-ui, sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  for (const u of [0.25, 0.75]) {
    g.save()
    g.translate(u * w, (v(0.3) + v(0.56)) / 2)
    g.rotate(-Math.PI / 2)
    g.fillText('MARSWALK', 0, 0)
    g.restore()
  }
})

const fairingTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#f1f0ec'; g.fillRect(0, 0, w, h)
  speckle(g, w, h, 1800, 0.025)
  g.fillStyle = 'rgba(70,70,76,0.3)'
  g.fillRect(w * 0.5 - 1, 0, 2, h) // the fairing's split line
  g.fillRect(0, 0, 2, h)
})

// Booster: dark lower half, white top, segment joints
const boosterTex = (y0, y1, dark1) => canvasTex(256, 1024, (g, w, h) => {
  const v = (y) => h - ((y - y0) / (y1 - y0)) * h
  g.fillStyle = '#efeeea'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#1a1a1d'; g.fillRect(0, v(dark1), w, h - v(dark1))
  speckle(g, w, h, 2500, 0.04)
  g.fillStyle = 'rgba(120,120,128,0.45)'
  for (const y of [0.1, 0.18, 0.34]) g.fillRect(0, v(y), w, 3)
  g.fillStyle = 'rgba(70,70,76,0.25)'
  for (let x = 0; x < w; x += w / 6) g.fillRect(x, 0, 1, v(dark1))
})

// soft round sprite for flame glow and smoke
const puffTex = () => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, w, w)
})

// ---------- flame: additive cone with flicker and shock diamonds ----------
const FLAME_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FLAME_FS = /* glsl */ `
uniform float time; uniform float power; uniform float seed;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  float along = 1.0 - vUv.y; // 0 at the nozzle .. 1 at the tail
  float n = noise(vec2(vUv.x * 10.0 + seed, along * 6.0 - time * 11.0)) * 0.6 + noise(vec2(vUv.x * 23.0, along * 14.0 - time * 19.0)) * 0.4;
  float body = smoothstep(1.0, 0.0, along + (n - 0.5) * 0.45);
  float diamonds = pow(0.5 + 0.5 * cos(along * 44.0 - time * 3.0), 8.0) * smoothstep(0.45, 0.04, along);
  vec3 hot = vec3(1.0, 0.98, 0.92), warm = vec3(1.0, 0.62, 0.28), tail = vec3(0.85, 0.32, 0.12);
  vec3 col = mix(hot, warm, smoothstep(0.04, 0.4, along));
  col = mix(col, tail, smoothstep(0.45, 1.0, along)) + diamonds * vec3(0.4, 0.5, 0.7);
  float a = clamp((body * body + diamonds * 0.5) * power, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`

function flame(radius, length, seed) {
  const g = new THREE.CylinderGeometry(radius * 0.9, radius * 2.6, length, 32, 10, true)
  g.translate(0, -length / 2, 0) // starts at the nozzle (y = 0), spreads as it leaves
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, power: { value: 1 }, seed: { value: seed } },
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  return new THREE.Mesh(g, m)
}

// ---------- exhaust smoke: particles streaming back from each nozzle (all on the GPU) ----------
const SMOKE_VS = /* glsl */ `
uniform float time; uniform float power; uniform float px; uniform vec3 nozzles[3]; uniform float alive[3];
attribute vec4 seed; attribute float which;
varying float vAge; varying float vAlive;
void main(){
  int k = int(which + 0.5);
  float life = 1.15 + seed.w * 0.6;
  float age = fract(time / life + seed.x);           // 0 just out of the nozzle .. 1 gone
  vec3 noz = k == 0 ? nozzles[0] : k == 1 ? nozzles[1] : nozzles[2];
  float a = seed.y * 6.2832, r = (0.02 + 0.16 * age * age) * (0.4 + seed.z);
  vec3 p = noz + vec3(cos(a) * r, -0.04 - age * (0.9 + seed.z * 0.5) * (0.4 + 0.6 * power), sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(px * (0.03 + 0.2 * age) / -mv.z, px * 0.12); // no huge puffs when the camera passes close
  vAge = age; vAlive = (k == 0 ? alive[0] : k == 1 ? alive[1] : alive[2]) * power;
}`
const SMOKE_FS = /* glsl */ `
uniform sampler2D puff;
varying float vAge; varying float vAlive;
void main(){
  float s = texture2D(puff, gl_PointCoord).a;
  vec3 col = mix(vec3(1.0, 0.82, 0.62), vec3(0.62, 0.58, 0.56), smoothstep(0.05, 0.5, vAge)); // lit by the flame, then grey
  float a = s * (1.0 - vAge) * (1.0 - vAge) * 0.5 * vAlive;
  gl_FragColor = vec4(col, a);
}`

export function createRocket() {
  const root = new THREE.Group() // moved along the flight path; +Y = direction of flight
  const shake = new THREE.Group() // engine vibration
  root.add(shake)
  const body = new THREE.Group() // rolls slowly about its long axis
  shake.add(body)

  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.04, ...o })
  const white = std({ color: 0xf0efeb })
  const black = std({ color: 0x141416, roughness: 0.55 })
  const metal = std({ color: 0x8f9196, roughness: 0.3, metalness: 0.8 })
  const nozzleMat = std({ color: 0x3c3d42, roughness: 0.28, metalness: 0.85, side: THREE.DoubleSide, emissive: new THREE.Color(0xff7a2a), emissiveIntensity: 0 })

  const lathe = (pts, m, parent = body, x = 0, seg = 72) => {
    const o = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m)
    o.position.x = x
    parent.add(o)
    return o
  }
  const cyl = (r1, r2, y0, y1, m, parent = body, x = 0, seg = 72) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, y1 - y0, seg, 1, true), m)
    o.position.set(x, (y0 + y1) / 2, 0)
    parent.add(o)
    return o
  }

  // core stage and upper stage, one painted cylinder from the engine bay to the fairing
  const CORE0 = 0.045, CORE1 = 0.8
  cyl(R, R, CORE0, CORE1, std({ map: coreTex(CORE0, CORE1, 0.6, 0.665) }))
  lathe([[R * 0.82, 0.0], [R * 0.9, 0.02], [R, CORE0]], metal) // engine bay
  // nose fairing: smooth ogive
  const ogive = []
  for (let i = 0; i <= 28; i++) { const t = i / 28; ogive.push([R * Math.pow(Math.max(0, 1 - t * t), 0.55) + (i === 28 ? 0 : 0), CORE1 + t * 0.2]) }
  ogive[ogive.length - 1][0] = 0.0006
  lathe(ogive, std({ map: fairingTex(), roughness: 0.3 }))
  // core engine nozzle
  const bell = (r0, r1, len) => { const p = []; for (let i = 0; i <= 14; i++) { const t = i / 14; p.push([r0 + (r1 - r0) * Math.pow(t, 0.6), -t * len]) } return p.reverse() }
  lathe(bell(0.012, 0.03, 0.06), nozzleMat, body, 0, 40).position.y = 0.006

  // strap-on boosters
  const boosters = []
  for (const sx of [1, -1]) {
    const b = new THREE.Group()
    body.add(b)
    const B0 = 0.01, B1 = 0.42
    cyl(BR, BR, B0, B1, std({ map: boosterTex(B0, B1, 0.26) }), b, sx * BX, 48)
    const cone = []
    for (let i = 0; i <= 20; i++) { const t = i / 20; cone.push([Math.max(0.0005, BR * Math.pow(1 - t * t, 0.5)), B1 + t * 0.1]) }
    lathe(cone, white, b, sx * BX, 48)
    lathe([[BR * 1.18, B0 - 0.012], [BR * 1.1, B0 - 0.004], [BR, B0 + 0.01]], black, b, sx * BX, 48) // aft skirt
    lathe(bell(0.009, 0.022, 0.04), nozzleMat, b, sx * BX, 32).position.y = B0 - 0.008
    // attach struts
    for (const y of [0.07, 0.36]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(BX - R - BR + 0.01, 0.006, 0.006), metal)
      s.position.set(sx * (R + (BX - R - BR) / 2), y, 0)
      b.add(s)
    }
    boosters.push({ group: b, sx, nozzleY: B0 - 0.048 })
  }

  // ---------- fire ----------
  const fire = new THREE.Group()
  body.add(fire)
  const coreFlame = flame(0.026, 0.62, 0.0)
  coreFlame.position.y = -0.054
  fire.add(coreFlame)
  const boosterFlames = boosters.map((b, i) => {
    const f = flame(0.019, 0.55, 3.1 + i)
    f.position.set(b.sx * BX, b.nozzleY, 0)
    b.group.add(f)
    return f
  })
  const flames = [coreFlame, ...boosterFlames]

  // hot glow at each nozzle
  const puff = puffTex()
  const glowMat = new THREE.SpriteMaterial({ map: puff, color: 0xffb070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  const glows = [[0, -0.06], ...boosters.map((b) => [b.sx * BX, b.nozzleY - 0.005])].map(([x, y]) => {
    const s = new THREE.Sprite(glowMat)
    s.position.set(x, y, 0); s.scale.setScalar(0.13)
    body.add(s)
    return s
  })

  // smoke particles
  const N = 2400
  const seeds = new Float32Array(N * 4), which = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    which[i] = i % 5 < 2 ? 0 : i % 5 < 4 ? 1 : 2 // more smoke from the boosters
  }
  const smokeGeo = new THREE.BufferGeometry()
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
  smokeGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4))
  smokeGeo.setAttribute('which', new THREE.BufferAttribute(which, 1))
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, power: { value: 1 }, px: { value: 800 }, puff: { value: puff },
      nozzles: { value: [new THREE.Vector3(0, -0.06, 0), new THREE.Vector3(BX, -0.04, 0), new THREE.Vector3(-BX, -0.04, 0)] },
      alive: { value: [1, 1, 1] },
    },
    vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS,
    transparent: true, depthWrite: false,
  })
  const smoke = new THREE.Points(smokeGeo, smokeMat)
  smoke.frustumCulled = false
  body.add(smoke)

  // the fire lights the rocket's base and boosters
  const fireLight = new THREE.PointLight(0xff9a50, 0, 0.9, 1.4)
  fireLight.position.set(0, -0.05, 0.06)
  body.add(fireLight)

  // booster separation: they drift off, tumbling, and fade from view
  let sepAt = null
  const sep = (t) => {
    const k = Math.max(0, t - sepAt)
    boosters.forEach((b, i) => {
      b.group.position.set(b.sx * (0.06 * k + 0.08 * k * k), -0.1 * k - 0.28 * k * k, (i ? -1 : 1) * 0.03 * k)
      b.group.rotation.z = -b.sx * (0.6 * k + 0.35 * k * k)
      b.group.visible = k < 1.5 // gone from view by then
    })
    smokeMat.uniforms.alive.value[1] = smokeMat.uniforms.alive.value[2] = Math.max(0, 1 - k * 2.5)
    return k < 0.35 // booster engines still burning
  }

  let t = 0
  return {
    object: root,
    /**
     * thrust 0..1 sets the fire; dt in seconds; px = drawing-buffer height in pixels.
     * separated: true once the boosters should leave.
     */
    update(thrust, dt, px = 800, separated = false) {
      t += dt
      body.rotation.y += dt * 0.12
      const on = thrust > 0.01
      fireLight.intensity = thrust * 1.6
      nozzleMat.emissiveIntensity = thrust * 0.5
      const j = 0.0016 * thrust
      shake.position.set(Math.sin(t * 61) * j, Math.sin(t * 47 + 1.3) * j * 0.6, Math.cos(t * 53) * j)
      if (separated && sepAt === null) sepAt = t
      if (!separated && sepAt !== null) { sepAt = null; boosters.forEach((b) => { b.group.position.set(0, 0, 0); b.group.rotation.z = 0; b.group.visible = true }); smokeMat.uniforms.alive.value = [1, 1, 1] }
      const boostersBurn = on && (sepAt === null || sep(t))
      fire.visible = on
      smoke.visible = on
      glows[0].visible = on
      boosterFlames.forEach((f) => { f.visible = boostersBurn })
      glows[1].visible = glows[2].visible = boostersBurn
      if (!on) return
      const flick = 1 + Math.sin(t * 43) * 0.05 + Math.sin(t * 19.7) * 0.05
      fire.scale.set(1, (0.45 + 0.55 * thrust) * flick, 1)
      for (const f of flames) { f.material.uniforms.time.value = t; f.material.uniforms.power.value = Math.min(1, thrust * 1.3) }
      for (const f of boosterFlames) f.scale.y = (0.45 + 0.55 * thrust) * flick
      glows.forEach((g, i) => g.scale.setScalar((i ? 0.1 : 0.14) * (0.6 + 0.4 * thrust) * flick))
      smokeMat.uniforms.time.value = t
      smokeMat.uniforms.power.value = thrust
      smokeMat.uniforms.px.value = px
    },
  }
}
