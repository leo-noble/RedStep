import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const rm = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
export const prefersReducedMotion = () => !!rm?.matches
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => { rm?.addEventListener('change', cb); return () => rm?.removeEventListener('change', cb) },
    () => !!rm?.matches,
    () => false,
  )
}

const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 820px)') : null
export function useNarrow() {
  return useSyncExternalStore(
    (cb) => { mq?.addEventListener('change', cb); return () => mq?.removeEventListener('change', cb) },
    () => !!mq?.matches,
    () => false,
  )
}

// localStorage can throw (private mode, blocked storage); the app must work without it.
const sameKind = (v, f) => {
  if (f === undefined || f === null) return true
  if (Array.isArray(f)) return Array.isArray(v)
  if (typeof f === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v)
  return typeof v === typeof f && (typeof v !== 'number' || Number.isFinite(v))
}

export const store = {
  // A saved value of the wrong kind (edited by hand, or from an older version of the site)
  // falls back to the default instead of breaking the page.
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key)
      if (v == null) return fallback
      const parsed = JSON.parse(v)
      return sameKind(parsed, fallback) ? parsed : fallback
    } catch { return fallback }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* not saved */ }
  },
}

// Background motion (the ambient dust and sky): on unless the system asks for reduced motion
// or the viewer switched it off in the footer. Shared by every component that shows it.
const motionSubs = new Set()
export const ambientMotion = {
  get: () => !prefersReducedMotion() && store.get('mw-ambient', true) !== false,
  set(on) { store.set('mw-ambient', on); motionSubs.forEach((f) => f()) },
}
export function useAmbientMotion() {
  return useSyncExternalStore(
    (cb) => { motionSubs.add(cb); rm?.addEventListener('change', cb); return () => { motionSubs.delete(cb); rm?.removeEventListener('change', cb) } },
    ambientMotion.get,
    () => false,
  )
}

export function useStored(key, fallback) {
  const [v, setV] = useState(() => store.get(key, fallback))
  useEffect(() => { store.set(key, v) }, [key, v])
  return [v, setV]
}

/** Animate a number into an element with rAF and direct text writes (no re-renders). */
export function useCountUp(value, format = (x) => String(Math.round(x)), ms = 900) {
  const ref = useRef(null)
  const from = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !Number.isFinite(value)) { el.textContent = format(value); from.current = value; return }
    const a = Number.isFinite(from.current) ? from.current : value
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      el.textContent = format(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, format, ms])
  return ref
}

/** Reveal-on-scroll: adds .in when the element enters the viewport. */
export function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { el.classList.add('in'); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
