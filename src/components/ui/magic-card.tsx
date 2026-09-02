import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientColor?: string
  gradientSize?: number
  gradientOpacity?: number
  gradientFrom?: string
  gradientTo?: string
}

export function MagicCard({
  className,
  children,
  gradientSize = 220,
  gradientColor = "#8b5cf6",
  gradientOpacity = 0.18,
  gradientFrom = "#8b5cf6",
  gradientTo = "#38bdf8",
  ...props
}: MagicCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0, show: false })

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top, show: true })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setPos((p) => ({ ...p, show: false }))}
      className={cn(
        "group relative rounded-[28px] glass-strong glass-card-3d overflow-hidden",
        "border border-white/10",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${gradientSize}px circle at ${pos.x}px ${pos.y}px, ${gradientColor}${Math.round(gradientOpacity*255).toString(16).padStart(2,"0")}, transparent 80%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
        style={{
          background: `linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.07) 50%, transparent 65%)`,
        }}
      />
    </div>
  )
}

export function MagicCard3D({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const cx = r.width / 2
    const cy = r.height / 2
    const rx = (y - cy) / 18
    const ry = (cx - x) / 18
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`
    el.style.setProperty("--mx", `${x}px`)
    el.style.setProperty("--my", `${y}px`)
  }
  const handleLeave = () => {
    if (ref.current) ref.current.style.transform = `perspective(900px) rotateX(0) rotateY(0) translateZ(0)`
  }
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("glass-strong rounded-[28px] spotlight transition-transform duration-300 will-change-transform", className)}
      {...(props as any)}
    >
      {children}
    </motion.div>
  )
}
