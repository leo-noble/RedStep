// The opening scene and the Mars globe, in one WebGL canvas.
// Phase "earth": Earth's night side with city lights, the Moon, hairline orbits.
// Phase "flight": an SLS rocket flies the transfer arc to Mars and swings around it on a parking
// orbit, with the camera riding alongside (about 10 s).
// Phase "globe": Mars fills the view; drag to spin, sites are pinned, lit by the real Sun.
//
// Textures are real NASA mosaics (see scripts/bake-site.mjs). Mars is lit from the actual
// subsolar point for the current time (Mars24), so the day/night line is where it really is.
import * as THREE from 'three'
import { marsTime } from '../lib/mars24.js'
import { createRocket } from './rocket.js'

const D = Math.PI / 180
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Unit vector for planetocentric lat/lon (deg, east) on a three.js SphereGeometry texture. */
export function lonLatToVec(lon, lat, r = 1) {
  return new THREE.Vector3(r * Math.cos(lat * D) * Math.cos(lon * D), r * Math.sin(lat * D), -r * Math.cos(lat * D) * Math.sin(lon * D))
}

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
  gl_FragColor = vec4(col, 1.0);
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
  gl_FragColor = vec4(color * f * lit * strength, f * lit * strength);
}`

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 4000)
  const loader = new THREE.TextureLoader()
  const tex = (file, srgb = true) => {
    const t = loader.load(texture(file))
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = renderer.capabilities.getMaxAnisotropy()
    return t
  }

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
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
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
  // (no 4k upgrade: Mars is only on screen for the last second of the flight before the map
  // takes over, so the extra 1.4 MB never showed)

  // Real subsolar point -> light direction in Mars's own frame.
  let marsSunLocal = new THREE.Vector3(1, 0, 0)
  const updateSun = () => {
    const t = marsTime(Date.now())
    marsSunLocal = lonLatToVec(t.subLonE, t.dec)
  }
  updateSun()

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

  // The rocket: NASA's Space Launch System, drawn far larger than life so it can be seen.
  const rocket = createRocket()
  const ROCKET_SIZE = 0.42
  rocket.object.visible = false
  scene.add(rocket.object)
  const UP = new THREE.Vector3(0, 1, 0)
  const qTmp = new THREE.Quaternion()
  const placeRocket = (pos, dir, size) => {
    rocket.object.position.copy(pos)
    rocket.object.quaternion.copy(qTmp.setFromUnitVectors(UP, dir))
    rocket.object.scale.setScalar(size)
  }
  // studio-style light on the rocket: a bright key from the upper right of the view, a soft fill
  const rocketKey = new THREE.DirectionalLight(0xfff4ea, 3.2)
  rocketKey.target = rocket.object
  const rocketFill = new THREE.DirectionalLight(0xb9ccff, 0.7)
  rocketFill.target = rocket.object
  scene.add(rocketKey, rocketFill)
  const camRight = new THREE.Vector3()
  const lightRocket = () => {
    camRight.subVectors(camLook, camPos).cross(camera.up).normalize()
    rocketKey.position.copy(rocket.object.position).addScaledVector(camRight, 2).addScaledVector(camera.up, 2.5).addScaledVector(camPos.clone().sub(rocket.object.position).normalize(), 1.5)
    rocketFill.position.copy(rocket.object.position).addScaledVector(camRight, -2).addScaledVector(camera.up, -0.5)
  }
  let orbitTheta = TH1
  let holdAt = null // screenshots: freeze the flight at a given moment
  const arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc.getPoints(240)), new THREE.LineDashedMaterial({ color: 0xec7d45, dashSize: 1.6, gapSize: 1.4, transparent: true, opacity: 0.55 }))
  arcLine.computeLineDistances()
  const ARC_POINTS = 241
  arcLine.geometry.setDrawRange(0, reducedMotion ? ARC_POINTS : 0)
  scene.add(arcLine)

  // ---- camera paths ----
  const camEarthWide = { pos: new THREE.Vector3(-2.2, 0.5, 6.2), look: new THREE.Vector3(-1.2, 0.1, 0) }
  // phones: Earth sits in the top half, above the headline
  const camEarthTall = { pos: new THREE.Vector3(0.1, 0.9, 11), look: new THREE.Vector3(0.2, -2.1, 0) }
  const camEarth = { pos: camEarthWide.pos.clone(), look: camEarthWide.look.clone() }
  const pickEarthCam = () => { const c = camera.aspect < 0.8 ? camEarthTall : camEarthWide; camEarth.pos.copy(c.pos); camEarth.look.copy(c.look) }
  const globeDist = () => (camera.aspect < 0.8 ? 10.4 : 5.4)
  const camGlobe = () => {
    const pos = MARS.clone().add(new THREE.Vector3(0, 0.25, globeDist()))
    return { pos, look: MARS.clone().add(new THREE.Vector3(camera.aspect > 1.2 ? -1.05 : 0, camera.aspect < 0.8 ? -1.55 : 0, 0)) }
  }

  let phase = 'earth'
  let flightT = 0
  const FLIGHT_S = 10
  const CRUISE_END = 0.72 // share of the flight spent on the transfer arc; the rest is the orbit
  const rp = new THREE.Vector3(), rdir = new THREE.Vector3(), side = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0)
  const camPos = camEarth.pos.clone(), camLook = camEarth.look.clone()
  camera.position.copy(camPos)
  camera.lookAt(camLook)

  // globe spin state
  const spin = { yaw: 0, pitch: 0.18, vYaw: 0, vPitch: 0, dragging: false, auto: !reducedMotion, zoom: 1 }
  // Start with the sunlit side turned mostly towards us, so the day/night line shows on the left.
  spin.yaw = 35 * D - Math.atan2(marsSunLocal.x, marsSunLocal.z)
  let focusAnim = null

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    pickEarthCam?.()
  }
  const ro = new ResizeObserver(size)
  ro.observe(canvas)
  size()

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

  // ---- loop ----
  let raf = 0, lastT = performance.now(), running = true
  const tmp = new THREE.Vector3()
  function frame(now, force = false) {
    raf = requestAnimationFrame(frame)
    if (!running && !force) return
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now

    // lights
    sunLight.position.copy(sunDir).multiplyScalar(100)
    if (!reducedMotion) {
      earth.rotation.y += dt * 0.02
      moon.rotation.y += dt * 0.004
    }
    earth.material.uniforms.sun.value.copy(earthSun).applyMatrix3(new THREE.Matrix3().setFromMatrix4(camera.matrixWorldInverse))
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
          spin.vYaw *= 0.94; spin.vPitch *= 0.9
          if (spin.auto) spin.yaw += dt * 0.035
        }
      }
    } else if (!reducedMotion) spin.yaw += dt * 0.05
    marsGroup.rotation.set(spin.pitch, spin.yaw, 0, 'XYZ')

    // Real sun on Mars: rotate the subsolar vector by the globe's own rotation.
    tmp.copy(marsSunLocal).applyQuaternion(marsGroup.quaternion)
    sunLight.position.copy(MARS).add(tmp.clone().multiplyScalar(50))
    sunLight.target.position.copy(MARS)
    sunLight.target.updateMatrixWorld()
    if (phase === 'earth' || (phase === 'flight' && flightT < 0.5)) {
      sunLight.position.copy(EARTH).add(sunDir.clone().multiplyScalar(50))
      sunLight.target.position.copy(EARTH)
      sunLight.target.updateMatrixWorld()
    }
    const camSpace = new THREE.Matrix3().setFromMatrix4(camera.matrixWorldInverse)
    marsAtmo.material.uniforms.sun.value.copy(tmp).applyMatrix3(camSpace).normalize()

    // camera
    let target
    if (phase === 'earth') {
      const t = now / 1000
      target = { pos: camEarth.pos.clone().add(new THREE.Vector3(Math.sin(t * 0.08) * 0.08, Math.cos(t * 0.06) * 0.05, 0)), look: camEarth.look }
      camPos.lerp(target.pos, 0.05); camLook.lerp(target.look, 0.05)
    } else if (phase === 'flight') {
      if (holdAt === null) flightT = Math.min(1, flightT + dt / FLIGHT_S)
      else flightT = holdAt
      const k = flightT
      const g = camGlobe()
      // rocket: along the transfer arc, then round Mars on the parking orbit
      if (k < CRUISE_END) {
        const u = ease(k / CRUISE_END)
        arc.getPointAt(u, rp); arc.getTangentAt(u, rdir)
      } else {
        const q = (k - CRUISE_END) / (1 - CRUISE_END)
        orbitTheta = TH0 + (TH1 - TH0) * (1 - Math.pow(1 - q, 2))
        orbitAt(orbitTheta, rp); orbitDir(orbitTheta, rdir)
      }
      placeRocket(rp, rdir, ROCKET_SIZE * (0.25 + 0.75 * smooth(0, 0.12, k)))
      // full thrust at departure, a steady burn on the way, engines off once in orbit
      rocket.update(k < CRUISE_END ? 1 - 0.35 * smooth(0.36, 0.5, k) : 0.65 * (1 - smooth(CRUISE_END, CRUISE_END + 0.06, k)), dt, renderer.domElement.height, k > 0.44)
      // camera: from the Earth view to riding beside the rocket, then back to frame Mars
      side.crossVectors(rdir, UP).normalize()
      // side-on, framed on the middle of rocket + flame; further back on tall phone screens
      const away = camera.aspect < 0.8 ? 2.6 : 1.2
      const mid = rp.clone().addScaledVector(rdir, 0.08)
      // slightly below the rocket, looking up at it, as in a launch photo
      const chasePos = mid.clone().addScaledVector(side, away).addScaledVector(UP, -0.12 * away)
      const chaseLook = mid
      const w0 = smooth(0.04, 0.17, k), w1 = smooth(0.6, 0.86, k)
      camPos.copy(camEarth.pos).lerp(chasePos, w0).lerp(g.pos, w1)
      camLook.copy(camEarth.look).lerp(chaseLook, w0).lerp(g.look, w1)
      // tilt the view so the rocket climbs diagonally across the screen
      camUp.copy(UP).lerp(rdir, 0.55 * w0 * (1 - w1)).normalize()
      onFrame({ phase, progress: flightT })
      if (flightT >= 1) setPhase('globe')
    } else {
      const g = camGlobe()
      const pos = MARS.clone().add(g.pos.clone().sub(MARS).multiplyScalar(spin.zoom))
      camPos.lerp(pos, 0.12); camLook.lerp(g.look, 0.12)
      // the rocket keeps circling Mars until the map takes over
      if (rocket.object.visible) {
        if (!reducedMotion) orbitTheta += dt * 0.18
        placeRocket(orbitAt(orbitTheta, rp), orbitDir(orbitTheta, rdir), ROCKET_SIZE)
        rocket.update(0, dt, renderer.domElement.height, true)
      }
    }
    camera.position.copy(camPos)
    camera.up.copy(phase === 'flight' ? camUp : UP)
    camera.lookAt(camLook)
    if (rocket.object.visible) lightRocket()
    // line timing: orbits fade in over ~1.8 s each, staggered; the arc draws on over 2.8 s
    const it = (now - introStart) / 1000
    for (const [line, target, delay] of orbits) line.material.opacity = reducedMotion ? target : target * smooth(delay, delay + 1.8, it)
    if (!reducedMotion) arcLine.geometry.setDrawRange(0, Math.round(ARC_POINTS * ease(Math.min(1, Math.max(0, (it - 1.1) / 2.8)))))
    arcLine.material.opacity = phase === 'globe' ? 0.0 : 0.55
    renderer.render(scene, camera)
    if (phase === 'globe') onFrame({ phase })
  }
  raf = requestAnimationFrame(frame)

  const vis = () => { running = !document.hidden; lastT = performance.now() }
  document.addEventListener('visibilitychange', vis)

  function setPhase(p) {
    phase = p
    onPhase(p)
  }

  return {
    get phase() { return phase },
    /** Step the scene by hand (used for screenshots when the tab is in the background). */
    step(frames = 1, ms = 16) {
      for (let i = 0; i < frames; i++) { lastT -= ms; cancelAnimationFrame(raf); frame(performance.now(), true) }
    },
    /** Freeze the flight at progress k (0..1), or pass null to let it run. For screenshots. */
    holdFlight(k) {
      holdAt = k
      if (k !== null && phase !== 'flight') { rocket.object.visible = true; setPhase('flight') }
    },
    begin() {
      if (phase !== 'earth') return
      if (reducedMotion) { this.skip(); return }
      flightT = 0
      rocket.object.visible = true
      setPhase('flight')
    },
    skip() {
      const g = camGlobe()
      camPos.copy(g.pos); camLook.copy(g.look)
      flightT = 1
      orbitTheta = TH1
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
      const toCam = camera.position.clone().sub(world).normalize()
      const facing = v.clone().normalize().dot(toCam)
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
        if (o.material) { Object.values(o.material.uniforms || {}).forEach((u) => u.value?.dispose?.()); o.material.map?.dispose?.(); o.material.dispose() }
      })
      Object.values(maps).forEach((m) => m?.dispose?.())
      relief.dispose()
      renderer.dispose()
    },
  }
}
