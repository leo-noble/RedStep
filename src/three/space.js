// The opening scene and the Mars globe, in one WebGL canvas.
// Phase "earth": Earth's night side with city lights, the Moon, hairline orbits.
// Phase "flight" (about 7 s): a wide shot of Earth and the Moon as the Marswalk rocket lifts off
// and drops its boosters; a soft fade; then Mars, with the rocket gliding in and swinging into
// orbit in front of it.
// Phase "globe": Mars fills the view; drag to spin, sites are pinned, lit by the real Sun.
//
// Textures are real NASA mosaics (see scripts/bake-site.mjs). Mars is lit from the actual
// subsolar point for the current time (Mars24), so the day/night line is where it really is.
// The picture goes through a small film pipeline: bloom on the engine fire, a soft vignette and
// grain. Quality drops on slow devices.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { marsTime } from '../lib/mars24.js'
import { createRocket } from './rocket.js'

const D = Math.PI / 180
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
/** Frame-rate independent approach: share of the gap to close this frame. */
const damp = (rate, dt) => 1 - Math.exp(-rate * dt)

/** Unit vector for planetocentric lat/lon (deg, east) on a three.js SphereGeometry texture. */
export function lonLatToVec(lon, lat, r = 1) {
  return new THREE.Vector3(r * Math.cos(lat * D) * Math.cos(lon * D), r * Math.sin(lat * D), -r * Math.cos(lat * D) * Math.sin(lon * D))
}

// These two shaders write display colours directly, so they convert to linear light for the
// film pipeline (which converts back at the end).
const EARTH_FS = /* glsl */ `
uniform sampler2D day; uniform sampler2D night; uniform vec3 sun;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN);
  float d = dot(n, sun);
  float k = smoothstep(-0.12, 0.2, d);
  vec3 dc = texture2D(day, vUv).rgb * (0.03 + 0.85 * max(d, 0.0));
  vec3 lights = texture2D(night, vUv).rgb;
  vec3 nc = pow(lights, vec3(1.35)) * vec3(1.0, 0.8, 0.55) * 2.1 + texture2D(day, vUv).rgb * 0.018;
  vec3 col = mix(nc, dc, k);
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
  col += vec3(0.25, 0.5, 1.0) * rim * smoothstep(-0.2, 0.5, d) * 0.35;
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), 1.0);
}`
const BASIC_VS = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`
const ATMO_FS = /* glsl */ `
uniform vec3 color; uniform vec3 sun; uniform float power; uniform float strength;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN);
  float f = pow(1.0 - abs(dot(n, normalize(vV))), power);
  float lit = mix(0.14, 1.0, smoothstep(-0.35, 0.45, dot(n, sun)));
  vec3 c = color * f * lit * strength;
  gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), f * lit * strength);
}`

// last pass before output: soft vignette and a little moving film grain
const FILM = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.42 }, grain: { value: 0.035 }, fade: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float time; uniform float vignette; uniform float grain; uniform float fade;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 d = (vUv - 0.5) * vec2(1.15, 1.0);
  c.rgb *= mix(1.0, smoothstep(0.85, 0.2, length(d)), vignette);
  float n = fract(sin(dot(vUv * 913.7 + time * 61.3, vec2(12.9898, 78.233))) * 43758.5453);
  c.rgb *= (1.0 + (n - 0.5) * grain) * fade;
  gl_FragColor = c;
}`,
}

function atmosphere(radius, color, sun, power, strength) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, sun: { value: sun }, power: { value: power }, strength: { value: strength } },
      vertexShader: BASIC_VS, fragmentShader: ATMO_FS,
      side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  )
}

function stars(count, radius) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u)
    pos.set([radius * s * Math.cos(t), radius * u, radius * s * Math.sin(t)], i * 3)
    const b = Math.pow(rnd(), 3) * 0.9 + 0.1
    const warm = rnd()
    col.set([b * (0.85 + 0.15 * warm), b * 0.9, b * (1 - 0.15 * warm)], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }))
}

function ring(center, r, opacity, segments = 512, color = 0xffffff) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new THREE.Vector3(center.x + r * Math.cos(a), center.y, center.z + r * Math.sin(a)))
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
}

export function createSpace(canvas, { texture = (file) => `/data/globe/${file}`, reducedMotion = false, onPhase = () => {}, onFrame = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  const quality = { dpr: Math.min(window.devicePixelRatio || 1, 1.5), level: 2 } // 2 full, 1 lighter, 0 basic
  renderer.setPixelRatio(quality.dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 4000)
  const loader = new THREE.TextureLoader()
  const tex = (file, srgb = true) => {
    const t = loader.load(texture(file))
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = renderer.capabilities.getMaxAnisotropy()
    return t
  }

  // film pipeline (multisampled so edges stay clean)
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  // only light brighter than white blooms: the engine fire and its glow, not the planets
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.28, 1.25)
  composer.addPass(bloom)
  const film = new ShaderPass(FILM)
  composer.addPass(film)
  composer.addPass(new OutputPass())

  // ---- layout (schematic, not to scale) ----
  // The Sun sits behind and to the right of Earth, so the camera sees Earth's night side.
  const SUN = new THREE.Vector3(250, 0, -40) // orbits centred here
  const EARTH = new THREE.Vector3(0, 0, 0)
  const sunDir = SUN.clone().sub(EARTH).normalize()
  const earthOrbit = SUN.distanceTo(EARTH)
  const marsOrbit = earthOrbit * 1.52
  const marsAngle = 178 * D
  const MARS = new THREE.Vector3(SUN.x + marsOrbit * Math.cos(marsAngle), 2, SUN.z + marsOrbit * Math.sin(marsAngle))
  const MARS_R = 1

  scene.add(stars(2600, 1600))
  // Hairline orbits fade in one after another; the transfer arc then draws itself on.
  const orbits = [[ring(SUN, earthOrbit, 0.14), 0.14, 0.2], [ring(SUN, marsOrbit, 0.12), 0.12, 0.55], [ring(SUN, (earthOrbit + marsOrbit) / 2, 0.04, 256), 0.04, 0.9]]
  for (const [line] of orbits) { line.material.opacity = 0; scene.add(line) }
  const introStart = performance.now()
  scene.add(new THREE.AmbientLight(0xffffff, 0.035))
  const sunLight = new THREE.DirectionalLight(0xfff4e8, 2.4)
  scene.add(sunLight)

  // Earth (night side to camera at the start), dim, with city lights.
  const earthSun = sunDir.clone()
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 96),
    new THREE.ShaderMaterial({ uniforms: { day: { value: tex('earth-day-2k.jpg') }, night: { value: tex('earth-night-2k.jpg') }, sun: { value: new THREE.Vector3() } }, vertexShader: BASIC_VS, fragmentShader: EARTH_FS }),
  )
  earth.position.copy(EARTH)
  earth.rotation.z = 23.4 * D
  const earthAtmo = atmosphere(1.02, 0x5b9bff, new THREE.Vector3(), 5.0, 0.55)
  earthAtmo.position.copy(EARTH)
  scene.add(earth, earthAtmo)

  // Moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.273, 96, 64), new THREE.MeshStandardMaterial({ map: tex('moon-lro-2k.jpg'), roughness: 1, metalness: 0 }))
  moon.position.set(3.4, 1.9, -5)
  scene.add(moon)

  // Mars globe group (spun by the user)
  const marsGroup = new THREE.Group()
  marsGroup.position.copy(MARS)
  scene.add(marsGroup)
  const maps = {
    viking: tex('mars-viking-2k.jpg'),
    mola: null, dust: null,
  }
  const relief = tex('mars-relief-2k.jpg', false)
  const marsMat = new THREE.MeshStandardMaterial({ map: maps.viking, bumpMap: relief, bumpScale: 0.9, roughness: 1, metalness: 0 })
  const mars = new THREE.Mesh(new THREE.SphereGeometry(MARS_R, 160, 120), marsMat)
  marsGroup.add(mars)
  const marsAtmo = atmosphere(MARS_R * 1.018, 0xe8a670, new THREE.Vector3(), 3.2, 0.9)
  marsGroup.add(marsAtmo)

  // Real subsolar point -> light direction in Mars's own frame.
  let marsSunLocal = new THREE.Vector3(1, 0, 0)
  const updateSun = () => {
    const t = marsTime(Date.now())
    marsSunLocal = lonLatToVec(t.subLonE, t.dec)
  }
  updateSun()

  // ---- the flight path ----
  // Parking orbit around Mars, well clear of the planet: the rocket joins it from the transfer arc
  // and swings round in front of the camera.
  const ORBIT_R = MARS_R * 1.75
  const orbA = new THREE.Vector3(1, 0, 0)
  const orbB = new THREE.Vector3(0, 0.3, 1).normalize()
  const TH0 = -40 * D, TH1 = 215 * D
  const orbitAt = (th, out = new THREE.Vector3()) => out.copy(MARS).addScaledVector(orbA, ORBIT_R * Math.cos(th)).addScaledVector(orbB, ORBIT_R * Math.sin(th))
  const orbitDir = (th, out = new THREE.Vector3()) => out.copy(orbA).multiplyScalar(-Math.sin(th)).addScaledVector(orbB, Math.cos(th)).normalize()
  const ENTRY = orbitAt(TH0)
  // lift-off point on Earth's limb, facing the camera
  const LAUNCH = EARTH.clone().add(new THREE.Vector3(-0.5, 0.62, 0.6).normalize().multiplyScalar(1.01))

  // Transfer arc (Hohmann-like, drawn as a hairline), ending where it meets the parking orbit
  const arc = new THREE.CubicBezierCurve3(
    LAUNCH,
    EARTH.clone().add(new THREE.Vector3(-40, 6, 70)),
    ENTRY.clone().addScaledVector(orbitDir(TH0), -70),
    ENTRY.clone(),
  )
  const arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc.getPoints(240)), new THREE.LineDashedMaterial({ color: 0xec7d45, dashSize: 1.6, gapSize: 1.4, transparent: true, opacity: 0.55 }))
  arcLine.computeLineDistances()
  const ARC_POINTS = 241
  arcLine.geometry.setDrawRange(0, reducedMotion ? ARC_POINTS : 0)
  scene.add(arcLine)

  // ---- the rocket (far larger than life so it can be seen) ----
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture // soft studio reflections on the paint
  const rocket = createRocket({ envMap })
  rocket.object.visible = false
  scene.add(rocket.object)
  const UP = new THREE.Vector3(0, 1, 0)
  const qTmp = new THREE.Quaternion()
  const placeRocket = (pos, dir, size) => {
    rocket.object.position.copy(pos)
    rocket.object.quaternion.copy(qTmp.setFromUnitVectors(UP, dir))
    rocket.object.scale.setScalar(size)
  }
  // studio-style light on the rocket: a bright key from the upper right of the view (casting soft
  // shadows of the boosters onto the core) and a cool fill from the other side. Both are narrow
  // spotlights aimed at the rocket, so they never light the planets.
  const spot = (color, intensity) => new THREE.SpotLight(color, intensity, 0, 0.16, 0.5, 0)
  const rocketKey = spot(0xfff4ea, 1.9)
  rocketKey.target = rocket.object
  rocketKey.castShadow = true
  rocketKey.shadow.mapSize.set(1024, 1024)
  Object.assign(rocketKey.shadow.camera, { near: 1, far: 9 })
  rocketKey.shadow.bias = -0.0004
  rocketKey.shadow.normalBias = 0.004
  const rocketFill = spot(0xb9ccff, 0.45)
  rocketFill.target = rocket.object
  scene.add(rocketKey, rocketFill)
  const camRight = new THREE.Vector3(), toCam = new THREE.Vector3()
  const lightRocket = () => {
    camRight.subVectors(camLook, camPos).cross(camera.up).normalize()
    toCam.subVectors(camPos, rocket.object.position).normalize()
    rocketKey.position.copy(rocket.object.position).addScaledVector(camRight, 2).addScaledVector(camera.up, 2.5).addScaledVector(toCam, 1.5)
    rocketFill.position.copy(rocket.object.position).addScaledVector(camRight, -3).addScaledVector(camera.up, -0.8).addScaledVector(toCam, 0.6)
  }

  // ---- camera ----
  const camEarthWide = { pos: new THREE.Vector3(-2.2, 0.5, 6.2), look: new THREE.Vector3(-1.2, 0.1, 0) }
  // phones: Earth sits in the top half, above the headline
  const camEarthTall = { pos: new THREE.Vector3(0.1, 0.9, 11), look: new THREE.Vector3(0.2, -2.1, 0) }
  const camEarth = { pos: camEarthWide.pos.clone(), look: camEarthWide.look.clone() }
  const pickEarthCam = () => { const c = camera.aspect < 0.8 ? camEarthTall : camEarthWide; camEarth.pos.copy(c.pos); camEarth.look.copy(c.look) }
  const tall = () => camera.aspect < 0.8
  const globeDist = () => (tall() ? 10.4 : 5.4)
  const globe = { pos: new THREE.Vector3(), look: new THREE.Vector3() }
  const camGlobe = () => {
    globe.pos.set(0, 0.25, globeDist()).add(MARS)
    globe.look.set(camera.aspect > 1.2 ? -1.05 : 0, tall() ? -1.55 : 0, 0).add(MARS)
    return globe
  }

  // ---- flight timeline (seconds) ----
  const FLIGHT_S = 7
  const IGNITE = 0.5 // engines light, then lift-off
  const SEPARATE = 2.4 // boosters drop away
  const LEAVE = 3.6 // rocket has left the Earth frame
  const CUT = 3.45 // fade to black ends here: from now on we are at Mars
  const ORBIT_IN = 5.4 // joins the parking orbit
  const ROCKET_EARTH = 0.58, ROCKET_MARS = 0.36
  let phase = 'earth'
  let T = 0
  let holdAt = null // screenshots: freeze the flight at a given moment
  let orbitTheta = TH1
  const rp = new THREE.Vector3(), rdir = new THREE.Vector3()
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3()
  const camPos = camEarth.pos.clone(), camLook = camEarth.look.clone()
  let fov = 32
  camera.position.copy(camPos)
  camera.lookAt(camLook)

  // The wide shot: Earth low on the left, the Moon above, room for the rocket to climb across.
  const wide = { pos: new THREE.Vector3(), look: new THREE.Vector3() }
  const setWide = () => {
    if (tall()) { wide.pos.set(0.9, 1.3, 15); wide.look.set(1.5, 0.4, -1.8) }
    else { wide.pos.set(-0.6, 0.9, 8.6); wide.look.set(1.5, 0.9, -1.4) }
  }
  // departure: from Earth's upper-right limb (as seen from the wide shot), climbing out of frame
  const departure = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3())
  const planDeparture = () => {
    setWide()
    const fwd = tmpA.subVectors(wide.look, wide.pos).normalize()
    const right = tmpB.crossVectors(fwd, UP).normalize()
    const dir = new THREE.Vector3().copy(right).multiplyScalar(0.72).addScaledVector(UP, 0.66).addScaledVector(fwd, -0.18).normalize()
    departure.v0.copy(dir).multiplyScalar(1.01).add(EARTH)
    departure.v1.copy(departure.v0).addScaledVector(dir, 0.9)
    departure.v2.copy(departure.v1).addScaledVector(right, 1.0).addScaledVector(UP, 0.75)
    departure.v3.copy(departure.v2).addScaledVector(right, 2.1).addScaledVector(UP, 1.3).addScaledVector(fwd, 0.6)
  }
  // arrival: the rocket glides in from behind Mars on the left and joins the orbit in front of it,
  // going round the other way (theta decreasing)
  const TH_IN = 150 * D
  const ARRIVAL = orbitAt(TH_IN)
  const arriveDir = orbitDir(TH_IN).negate()
  const arrival = new THREE.CubicBezierCurve3(
    ARRIVAL.clone().addScaledVector(arriveDir, -6.5).addScaledVector(UP, 0.5),
    ARRIVAL.clone().addScaledVector(arriveDir, -3.8),
    ARRIVAL.clone().addScaledVector(arriveDir, -1.6),
    ARRIVAL.clone(),
  )
  const ARRIVE_LEN = arrival.getLength()
  const W_IN = (0.5 * ARRIVE_LEN / (ORBIT_IN - CUT)) / ORBIT_R // angular speed when it joins the orbit
  const W_END = 0.18 // and once it has settled (the globe phase keeps this pace)

  /** Where the rocket is at flight time t, and which way it points; returns its size. */
  function rocketAt(t) {
    if (t < CUT) {
      const x = clamp01((t - IGNITE) / (LEAVE - IGNITE))
      const u = x * x // speeding up
      departure.getPointAt(Math.min(u, 1), rp); departure.getTangentAt(Math.min(u, 1), rdir)
      return ROCKET_EARTH
    }
    if (t < ORBIT_IN) {
      const x = clamp01((t - CUT) / (ORBIT_IN - CUT))
      const u = 0.5 * x + 0.5 * x * (2 - x) // slowing to half speed as it reaches the orbit
      arrival.getPointAt(u, rp); arrival.getTangentAt(u, rdir)
      return ROCKET_MARS
    }
    const dtO = t - ORBIT_IN, span = FLIGHT_S - ORBIT_IN
    const a = (W_IN - W_END) / span
    orbitTheta = TH_IN - (W_IN * dtO - 0.5 * a * dtO * dtO)
    orbitAt(orbitTheta, rp); orbitDir(orbitTheta, rdir).negate()
    return ROCKET_MARS
  }
  const thrustAt = (t) => {
    if (t < IGNITE) return smooth(0, IGNITE, t) // ignition
    if (t < CUT) return 1 - 0.25 * smooth(SEPARATE, SEPARATE + 0.5, t)
    return 0.5 * (1 - smooth(ORBIT_IN - 0.6, ORBIT_IN, t)) // a last burn on the way in, then quiet
  }

  // globe spin state
  const spin = { yaw: 0, pitch: 0.18, vYaw: 0, vPitch: 0, dragging: false, auto: !reducedMotion, zoom: 1 }
  // Start with the sunlit side turned mostly towards us, so the day/night line shows on the left.
  spin.yaw = 35 * D - Math.atan2(marsSunLocal.x, marsSunLocal.z)
  let focusAnim = null

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    composer.setPixelRatio(quality.dpr)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    pickEarthCam?.()
  }
  const ro = new ResizeObserver(size)
  ro.observe(canvas)
  size()

  // Keep it smooth: if frames run long for a couple of seconds, step the quality down.
  let frameAvg = 1 / 60, slowFor = 0
  function adapt(dt) {
    frameAvg += (dt - frameAvg) * 0.05
    slowFor = frameAvg > 1 / 40 ? slowFor + dt : 0
    if (slowFor < 2 || quality.level === 0) return
    slowFor = 0
    quality.level--
    if (quality.level === 1) { quality.dpr = 1; rocketKey.castShadow = false }
    if (quality.level === 0) { bloom.enabled = false; film.enabled = false }
    size()
  }

  // ---- input on the globe ----
  let last = null
  const down = (e) => {
    if (phase !== 'globe') return
    spin.dragging = true; spin.auto = false; focusAnim = null
    last = [e.clientX, e.clientY]
    canvas.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    if (!spin.dragging || !last) return
    const dx = e.clientX - last[0], dy = e.clientY - last[1]
    last = [e.clientX, e.clientY]
    spin.vYaw = dx * 0.005; spin.vPitch = dy * 0.004
    spin.yaw += spin.vYaw; spin.pitch = Math.max(-1.2, Math.min(1.2, spin.pitch + spin.vPitch))
  }
  const up = () => { spin.dragging = false; last = null }
  const wheel = (e) => {
    if (phase !== 'globe') return
    e.preventDefault()
    spin.zoom = Math.max(0.62, Math.min(1.5, spin.zoom * (1 + e.deltaY * 0.001)))
  }
  canvas.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  canvas.addEventListener('wheel', wheel, { passive: false })

  // ---- the flight ----
  function flight(dt) {
    if (holdAt === null) T = Math.min(FLIGHT_S, T + dt)
    else T = holdAt * FLIGHT_S
    const size = rocketAt(T)
    placeRocket(rp, rdir, size)
    rocket.update(thrustAt(T), dt, renderer.domElement.height, T > SEPARATE)

    const k = holdAt === null ? damp(1.8, dt) : 1
    if (T < CUT) {
      // ease from the opening view into the wide shot, with a slow push in
      const push = 1 - 0.06 * smooth(0, CUT, T)
      tmpA.copy(wide.pos).sub(wide.look).multiplyScalar(push).add(wide.look)
      camPos.lerp(tmpA, k); camLook.lerp(wide.look, k)
    } else {
      // at Mars: a fixed view, settling in slowly
      const g = camGlobe()
      const back = 1 + 0.1 * (1 - smooth(CUT, FLIGHT_S, T))
      camPos.copy(g.pos).sub(MARS).multiplyScalar(back).add(MARS)
      camLook.copy(g.look)
    }
    // a soft fade to black carries us from Earth to Mars
    film.uniforms.fade.value = T < CUT ? 1 - smooth(CUT - 0.45, CUT, T) : smooth(CUT, CUT + 0.55, T)

    onFrame({ phase, progress: T / FLIGHT_S })
    if (T >= FLIGHT_S && holdAt === null) setPhase('globe')
  }

  // ---- loop ----
  let raf = 0, lastT = performance.now(), running = true
  const tmp = new THREE.Vector3()
  const viewMat = new THREE.Matrix3()
  const earthDrift = new THREE.Vector3()
  function frame(now, force = false) {
    raf = requestAnimationFrame(frame)
    if (!running && !force) return
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    if (!force) adapt(dt)

    // lights
    sunLight.position.copy(sunDir).multiplyScalar(100)
    if (!reducedMotion) {
      earth.rotation.y += dt * 0.02
      moon.rotation.y += dt * 0.004
    }
    viewMat.setFromMatrix4(camera.matrixWorldInverse)
    earth.material.uniforms.sun.value.copy(earthSun).applyMatrix3(viewMat)
    earthAtmo.material.uniforms.sun.value.copy(earth.material.uniforms.sun.value)

    // Mars orientation
    if (phase === 'globe') {
      if (!spin.dragging) {
        if (focusAnim) {
          const k = Math.min(1, (now - focusAnim.t0) / focusAnim.ms)
          const e2 = ease(k)
          spin.yaw = focusAnim.yaw0 + (focusAnim.yaw1 - focusAnim.yaw0) * e2
          spin.pitch = focusAnim.pitch0 + (focusAnim.pitch1 - focusAnim.pitch0) * e2
          spin.zoom = focusAnim.zoom0 + (focusAnim.zoom1 - focusAnim.zoom0) * e2
          if (k >= 1) { const cb = focusAnim.done; focusAnim = null; cb && cb() }
        } else {
          spin.yaw += spin.vYaw; spin.pitch = Math.max(-1.2, Math.min(1.2, spin.pitch + spin.vPitch))
          spin.vYaw *= Math.pow(0.94, dt * 60); spin.vPitch *= Math.pow(0.9, dt * 60)
          if (spin.auto) spin.yaw += dt * 0.035
        }
      }
    } else if (!reducedMotion) spin.yaw += dt * 0.05
    marsGroup.rotation.set(spin.pitch, spin.yaw, 0, 'XYZ')

    // Real sun on Mars: rotate the subsolar vector by the globe's own rotation.
    tmp.copy(marsSunLocal).applyQuaternion(marsGroup.quaternion)
    if (phase === 'earth' || (phase === 'flight' && T < CUT)) {
      sunLight.position.copy(sunDir).multiplyScalar(50).add(EARTH)
      sunLight.target.position.copy(EARTH)
    } else {
      sunLight.position.copy(tmp).multiplyScalar(50).add(MARS)
      sunLight.target.position.copy(MARS)
    }
    sunLight.target.updateMatrixWorld()
    marsAtmo.material.uniforms.sun.value.copy(tmp).applyMatrix3(viewMat).normalize()

    // camera
    if (phase === 'earth') {
      const t = now / 1000
      earthDrift.set(Math.sin(t * 0.08) * 0.08, Math.cos(t * 0.06) * 0.05, 0).add(camEarth.pos)
      const k = damp(2.5, dt)
      camPos.lerp(earthDrift, k); camLook.lerp(camEarth.look, k)
    } else if (phase === 'flight') {
      flight(dt)
    } else {
      const g = camGlobe()
      tmpB.copy(g.pos).sub(MARS).multiplyScalar(spin.zoom).add(MARS)
      const k = damp(7, dt)
      camPos.lerp(tmpB, k); camLook.lerp(g.look, k)
      fov += (32 - fov) * k
      film.uniforms.fade.value += (1 - film.uniforms.fade.value) * k
      // the rocket keeps circling Mars until the map takes over
      if (rocket.object.visible) {
        if (!reducedMotion) orbitTheta -= dt * W_END
        placeRocket(orbitAt(orbitTheta, rp), orbitDir(orbitTheta, rdir).negate(), ROCKET_MARS)
        rocket.update(0, dt, renderer.domElement.height, true)
      }
    }
    camera.position.copy(camPos)
    camera.up.copy(UP)
    camera.lookAt(camLook)
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix() }
    if (rocket.object.visible) lightRocket()
    // line timing: orbits fade in over ~1.8 s each, staggered; the arc draws on over 2.8 s.
    // Once the flight starts they fade out, so no hairlines cut across the shots.
    const it = (now - introStart) / 1000
    const linesOn = phase === 'earth' ? 1 : phase === 'flight' ? 1 - smooth(0, 0.8, T) : 0
    for (const [line, target, delay] of orbits) line.material.opacity = (reducedMotion ? target : target * smooth(delay, delay + 1.8, it)) * linesOn
    if (!reducedMotion) arcLine.geometry.setDrawRange(0, Math.round(ARC_POINTS * ease(Math.min(1, Math.max(0, (it - 1.1) / 2.8)))))
    arcLine.material.opacity = 0.55 * linesOn
    film.uniforms.time.value = now / 1000
    composer.render(dt)
    if (phase === 'globe') onFrame({ phase })
  }
  raf = requestAnimationFrame(frame)

  const vis = () => { running = !document.hidden; lastT = performance.now() }
  document.addEventListener('visibilitychange', vis)

  function setPhase(p) {
    phase = p
    onPhase(p)
  }

  function startFlight() {
    T = 0
    planDeparture()
    rocket.object.visible = true
    setPhase('flight')
  }

  return {
    get phase() { return phase },
    /** Step the scene by hand (used for screenshots when the tab is in the background). */
    step(frames = 1, ms = 16) {
      for (let i = 0; i < frames; i++) { lastT -= ms; cancelAnimationFrame(raf); frame(performance.now(), true) }
    },
    /** Freeze the flight at progress k (0..1), or pass null to let it run. For screenshots. */
    holdFlight(k) {
      if (k !== null && phase !== 'flight') startFlight()
      holdAt = k
    },
    begin() {
      if (phase !== 'earth') return
      if (reducedMotion) { this.skip(); return }
      startFlight()
    },
    skip() {
      const g = camGlobe()
      camPos.copy(g.pos); camLook.copy(g.look); fov = 32
      film.uniforms.fade.value = 1
      T = FLIGHT_S
      orbitTheta = TH_IN - 80 * D
      rocket.object.visible = true
      setPhase('globe')
    },
    setLayer(id) {
      if (!maps[id]) maps[id] = tex(id === 'mola' ? 'mars-mola-2k.jpg' : 'mars-tes-dust-1k.webp')
      marsMat.map = maps[id]
      marsMat.bumpScale = id === 'viking' ? 0.9 : 0.4
      marsMat.needsUpdate = true
    },
    /** Spin the globe so a site faces the camera, then call done. */
    focus(lon, lat, done, zoom = 0.72) {
      spin.auto = false
      // We want R(pitch, yaw) * v(lon,lat) to point at +Z (towards the camera).
      const yaw1 = Math.atan2(-Math.cos(lat * D) * Math.cos(lon * D), -Math.cos(lat * D) * Math.sin(lon * D))
      let y0 = spin.yaw % (Math.PI * 2)
      let y1 = yaw1 % (Math.PI * 2)
      if (y1 - y0 > Math.PI) y1 -= Math.PI * 2
      if (y0 - y1 > Math.PI) y1 += Math.PI * 2
      focusAnim = { t0: performance.now(), ms: reducedMotion ? 1 : 1500, yaw0: y0, yaw1: y1, pitch0: spin.pitch, pitch1: lat * D, zoom0: spin.zoom, zoom1: zoom, done }
      spin.yaw = y0
    },
    /** Screen position (CSS px) of a site and whether it faces the camera. */
    project(lon, lat) {
      const v = lonLatToVec(lon, lat, MARS_R * 1.005).applyQuaternion(marsGroup.quaternion)
      const world = v.clone().add(MARS)
      const toC = camera.position.clone().sub(world).normalize()
      const facing = v.clone().normalize().dot(toC)
      const sp = world.project(camera)
      const lit = v.clone().normalize().dot(tmp.copy(marsSunLocal).applyQuaternion(marsGroup.quaternion))
      return { x: (sp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-sp.y * 0.5 + 0.5) * canvas.clientHeight, facing, lit }
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', vis)
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      canvas.removeEventListener('wheel', wheel)
      scene.traverse((o) => {
        o.geometry?.dispose()
        if (o.material) {
          Object.values(o.material.uniforms || {}).forEach((u) => u.value?.dispose?.())
          for (const k of ['map', 'bumpMap', 'envMap']) o.material[k]?.dispose?.()
          o.material.dispose()
        }
      })
      Object.values(maps).forEach((m) => m?.dispose?.())
      relief.dispose()
      envMap.dispose()
      pmrem.dispose()
      composer.dispose()
      target.dispose()
      renderer.dispose()
    },
  }
}
