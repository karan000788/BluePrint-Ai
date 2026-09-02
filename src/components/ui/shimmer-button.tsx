import { cn } from "@/lib/utils"

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
}

export function ShimmerButton({
  children,
  className,
  shimmerColor = "#ffffff",
  shimmerSize = "0.1em",
  shimmerDuration = "2s",
  borderRadius = "9999px",
  background = "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      style={
        {
          "--shimmer-color": shimmerColor,
          "--radius": borderRadius,
          "--speed": shimmerDuration,
          "--cut": shimmerSize,
          "--bg": background,
        } as React.CSSProperties
      }
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-2.5 text-white [background:var(--bg)] [border-radius:var(--radius)] font-medium transition-all",
        "hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] active:scale-[0.97]",
        className
      )}
      {...props}
    >
      <div className="absolute -top-[1px] -bottom-[1px] left-0 right-0 overflow-hidden [border-radius:var(--radius)]">
        <div className="absolute inset-0 [border-radius:var(--radius)] [background:linear-gradient(90deg,transparent,var(--shimmer-color),transparent)] opacity-0 group-hover:opacity-20 transition-opacity" style={{ animation: `shimmer 1.8s linear infinite` }} />
      </div>
      <span className="relative flex items-center gap-2">{children}</span>
      <div
        className="absolute inset-0 -z-10 [border-radius:var(--radius)] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(300px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.18), transparent 70%)`,
        }}
      />
    </button>
  )
}
