// Ambient background: a faint, dusty butterscotch glow (the colour of Mars's daytime sky in rover
// photos) with slow drifting dust. Decoration only, behind the content: it never blocks clicks,
// pauses when off screen or in a hidden tab, and stands still for reduced motion or when the
// viewer turns background motion off (footer switch).
import { useEffect, useRef } from 'react'
import { useAmbientMotion } from '../lib/hooks.js'
import './ambient.css'

const FPS = 30

export default function Ambient({ className = '' }) {
  const ref = useRef(null)
  const moving = useAmbientMotion()

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    let w = 0, h = 0, dust = [], raf = 0, last = 0, visible = true, t = 0

    const seed = () => {
      const n = Math.min(90, Math.round((w * h) / 9000))
      dust = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.6, v: 6 + Math.random() * 16, a: 0.12 + Math.random() * 0.3, p: Math.random() * 6.28 }))
    }
    const size = () => {
      w = c.clientWidth; h = c.clientHeight
      c.width = w; c.height = h // one pixel per CSS pixel is plenty for soft dust
      seed(); draw()
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      // hazy, sunlit dust high in the sky, breathing very slowly
      const k = 0.85 + 0.15 * Math.sin(t / 9)
      const g = ctx.createRadialGradient(w * 0.78, -h * 0.1, 0, w * 0.78, -h * 0.1, Math.max(w, h) * 0.9)
      g.addColorStop(0, `rgba(214, 140, 84, ${0.16 * k})`)
      g.addColorStop(0.5, `rgba(150, 78, 40, ${0.06 * k})`)
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      for (const d of dust) {
        ctx.globalAlpha = d.a
        ctx.fillStyle = '#e3b48a'
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, 6.29)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden || now - last < 1000 / FPS) return
      const dt = Math.min(0.1, (now - (last || now)) / 1000)
      last = now; t += dt
      for (const d of dust) {
        d.x += d.v * dt
        d.y += Math.sin(t * 0.6 + d.p) * 4 * dt
        if (d.x > w + 4) { d.x = -4; d.y = Math.random() * h }
      }
      draw()
    }

    const ro = new ResizeObserver(size)
    ro.observe(c)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
    io.observe(c)
    size()
    if (moving) raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [moving])

  return <canvas ref={ref} className={`ambient ${className}`} aria-hidden="true" />
}
