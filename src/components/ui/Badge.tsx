import { cn } from "@/lib/utils";

export function Badge({ children, className, variant = "neutral" }: {
  children: React.ReactNode;
  className?: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const variants = {
    neutral: "bg-panel text-text-mute border-border hover:bg-border/50",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200/50 dark:border-green-800/50",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200/50 dark:border-yellow-800/50",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200/50 dark:border-red-800/50",
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
