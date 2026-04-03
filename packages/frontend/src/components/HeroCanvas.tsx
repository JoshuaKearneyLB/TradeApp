import { useRef, useEffect } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number; opacity: number
}

// Pre-render a single glow sprite once — reused every frame via drawImage
function makeGlowSprite(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, 'rgba(34,197,94,0.45)')
  g.addColorStop(1, 'rgba(34,197,94,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    const GLOW_SIZE = 28
    const glowSprite = makeGlowSprite(GLOW_SIZE)
    const HALF_GLOW = GLOW_SIZE / 2

    let W = 0, H = 0
    let particles: Particle[] = []
    let raf: number

    function resize() {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W
      canvas.height = H
      const count = Math.min(Math.floor((W * H) / 14000), 90)
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.8,
        opacity: Math.random() * 0.5 + 0.25,
      }))
    }

    const MAX_DIST = 120
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST
    const REPEL = 100
    const REPEL_SQ = REPEL * REPEL

    function draw() {
      ctx.clearRect(0, 0, W, H)

      const mx = mouse.current.x
      const my = mouse.current.y

      // Update positions
      for (const p of particles) {
        const dx = p.x - mx
        const dy = p.y - my
        const d2 = dx * dx + dy * dy
        if (d2 < REPEL_SQ && d2 > 0) {
          const d = Math.sqrt(d2)
          const force = ((REPEL - d) / REPEL) * 0.85
          p.vx += (dx / d) * force
          p.vy += (dy / d) * force
        }
        p.vx *= 0.97; p.vy *= 0.97
        const spd = p.vx * p.vx + p.vy * p.vy
        if (spd > 2.56) { // 1.6²
          const s = 1.6 / Math.sqrt(spd)
          p.vx *= s; p.vy *= s
        }
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0
      }

      // Connections — spatial grid cuts this from O(n²) to O(n)
      const CELL = MAX_DIST
      const cols = Math.ceil(W / CELL) + 1
      const grid: number[][] = Array.from({ length: cols * (Math.ceil(H / CELL) + 1) }, () => [])
      const rows = Math.ceil(H / CELL) + 1

      for (let i = 0; i < particles.length; i++) {
        const col = Math.floor(particles[i].x / CELL)
        const row = Math.floor(particles[i].y / CELL)
        const idx = row * cols + col
        if (idx >= 0 && idx < grid.length) grid[idx].push(i)
      }

      ctx.lineWidth = 0.7
      for (let i = 0; i < particles.length; i++) {
        const col = Math.floor(particles[i].x / CELL)
        const row = Math.floor(particles[i].y / CELL)
        for (let dc = 0; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (dc === 0 && dr <= 0) continue // only check forward to avoid duplicates
            const nc = col + dc, nr = row + dr
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
            const cell = grid[nr * cols + nc]
            for (const j of cell) {
              const dx = particles[i].x - particles[j].x
              const dy = particles[i].y - particles[j].y
              const d2 = dx * dx + dy * dy
              if (d2 < MAX_DIST_SQ) {
                const alpha = (1 - Math.sqrt(d2) / MAX_DIST) * 0.28
                ctx.strokeStyle = `rgba(34,197,94,${alpha})`
                ctx.beginPath()
                ctx.moveTo(particles[i].x, particles[i].y)
                ctx.lineTo(particles[j].x, particles[j].y)
                ctx.stroke()
              }
            }
          }
        }
      }

      // Dots — glow via pre-rendered sprite (no per-frame gradient creation)
      for (const p of particles) {
        ctx.globalAlpha = p.opacity * 0.7
        ctx.drawImage(glowSprite, p.x - HALF_GLOW, p.y - HALF_GLOW, GLOW_SIZE, GLOW_SIZE)
        ctx.globalAlpha = p.opacity
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(34,197,94,1)`
        ctx.fill()
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - rect.left
      mouse.current.y = e.clientY - rect.top
    }
    const onLeave = () => { mouse.current.x = -9999; mouse.current.y = -9999 }

    const parent = canvas.parentElement
    parent?.addEventListener('mousemove', onMove)
    parent?.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      parent?.removeEventListener('mousemove', onMove)
      parent?.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
