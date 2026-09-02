import { useEffect, useRef } from "react"

export function Particles({ className, quantity = 40 }: { className?: string; quantity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0
    canvas.width = canvas.offsetWidth * devicePixelRatio
    canvas.height = canvas.offsetHeight * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const ww = canvas.offsetWidth
    const hh = canvas.offsetHeight
    const dots = Array.from({ length: quantity }, () => ({
      x: Math.random() * ww,
      y: Math.random() * hh,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.4 + 0.4,
      a: Math.random() * 0.35 + 0.15,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, ww, hh)
      dots.forEach((d) => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > ww) d.vx *= -1
        if (d.y < 0 || d.y > hh) d.vy *= -1
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(168,139,250,${d.a})`
        ctx.fill()
      })
      dots.forEach((a, i) => {
        dots.slice(i + 1).forEach((b) => {
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 110) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(139,92,246,${0.08 * (1 - dist / 110)})`
            ctx.lineWidth = 0.7
            ctx.stroke()
          }
        })
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    const onResize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      ctx.setTransform(1,0,0,1,0,0); ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    window.addEventListener("resize", onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize) }
  }, [quantity])
  return <canvas ref={ref} className={className} style={{ width: "100%", height: "100%" }} />
}
