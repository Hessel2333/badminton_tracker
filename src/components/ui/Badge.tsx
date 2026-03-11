import { cn } from "@/lib/utils";

export function Badge({ children, className, variant = "neutral" }: {
  children: React.ReactNode;
  className?: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const variants = {
    neutral: "bg-panel text-text-mute border-border hover:bg-border/50",
    success: "bg-[var(--success-soft-bg)] text-[var(--success-soft-text)] border-[var(--success-soft-border)]",
    warning: "bg-[var(--warning-soft-bg)] text-[var(--warning-soft-text)] border-[var(--warning-soft-border)]",
    danger: "bg-[var(--danger-soft-bg)] text-[var(--danger-soft-text)] border-[var(--danger-soft-border)]",
    accent: "bg-accent/10 text-accent border-accent/20",
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
