import { cn } from "@/lib/utils"

export function Glass({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-[24px]", className)} {...props} />
}
export function GlassStrong({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-strong rounded-[28px]", className)} {...props} />
}
export function ShimmerText({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("shimmer-text", className)}>{children}</span>
}
