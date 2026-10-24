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
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v) } catch { return fallback }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* not saved */ }
  },
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
