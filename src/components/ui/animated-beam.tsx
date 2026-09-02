import { motion } from "framer-motion"

export function GridPattern({ className }: { className?: string }) {
  return (
    <div className={className} style={{
      backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
      backgroundSize: "32px 32px",
      maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
      WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
    }} />
  )
}

export function GlowOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay }}
      className={className}
      style={{ filter: "blur(60px)" }}
    />
  )
}
