import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Animate } from "./Animate";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  variant?: "hero" | "standard" | "minimal";
  className?: string;
}

export function SectionTitle({
  title,
  subtitle,
  actions,
  icon: Icon,
  variant = "standard",
  className
}: SectionTitleProps) {
  if (variant === "minimal") {
    return (
      <div className={cn("mb-4 flex items-center justify-between gap-4", className)}>
        <h2 className="font-display text-lg tracking-tight text-text">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={cn(
        "relative mb-8 overflow-hidden rounded-[34px] border border-[var(--border)] bg-[color:var(--panel)] p-6 backdrop-blur-2xl shadow-[0_20px_56px_rgba(15,23,42,0.08)] md:p-8",
        "before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.26),transparent_36%)]",
        className
      )}>
        <div className="absolute inset-x-8 top-0 h-px bg-white/45" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4 md:gap-6">
            {Icon && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/40 bg-white/55 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:h-14 md:w-14">
                <Icon className="h-6 w-6 md:h-7 md:w-7" />
              </div>
            )}
            <Animate
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="font-display text-[2rem] font-semibold tracking-[-0.04em] text-text md:text-[2.5rem]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-mute md:mt-2.5 md:text-base">
                  {subtitle}
                </p>
              )}
            </Animate>
          </div>

          {actions && (
            <Animate
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex items-center gap-3 shrink-0"
            >
              {actions}
            </Animate>
          )}
        </div>
      </div>
    );
  }

  // Default: Standard
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-6 px-1", className)}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--border)] bg-[color:var(--panel-2)] text-accent shadow-[inset_0_1px_0_var(--glass-border)]">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="font-display text-[1.85rem] font-semibold tracking-[-0.04em] text-text md:text-[2.35rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-text-mute">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
