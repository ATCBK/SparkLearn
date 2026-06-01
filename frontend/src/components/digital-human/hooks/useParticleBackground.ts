import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  radius: number
  color: string
  alpha: number
  speedY: number
  driftX: number
  driftPhase: number
}

const PARTICLE_COUNT = 200
const COLORS = [
  { r: 79, g: 195, b: 247 },   // #4fc3f7 blue
  { r: 124, g: 77, b: 255 },   // #7c4dff purple
  { r: 255, g: 255, b: 255 },  // white
]

export function useParticleBackground(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean = true,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animIdRef = useRef<number>(0)

  const createParticles = useCallback((width: number, height: number): Particle[] => {
    const particles: Particle[] = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const color = COLORS[i % COLORS.length]
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 1 + Math.random() * 2,
        color: `rgba(${color.r},${color.g},${color.b}`,
        alpha: 0.1 + Math.random() * 0.2,
        speedY: 0.2 + Math.random() * 0.4,
        driftX: 0.1 + Math.random() * 0.3,
        driftPhase: Math.random() * Math.PI * 2,
      })
    }
    return particles
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '0'
    container.style.position = 'relative'
    container.appendChild(canvas)
    canvasRef.current = canvas

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: Particle[] = []
    let width = 0
    let height = 0

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      particles = createParticles(width, height)
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    let lastTime = performance.now()

    function animate(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      ctx!.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.y -= p.speedY * dt * 30
        p.x += Math.sin(now * 0.001 * p.driftX + p.driftPhase) * 0.3
        p.driftPhase += dt * 0.2

        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        ctx!.fillStyle = `${p.color},${p.alpha})`
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fill()
      }

      animIdRef.current = requestAnimationFrame(animate)
    }

    animIdRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animIdRef.current)
      resizeObserver.disconnect()
      canvas.remove()
      canvasRef.current = null
    }
  }, [containerRef, enabled, createParticles])
}
