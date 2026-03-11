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
        "relative mb-8 overflow-hidden rounded-[32px] border border-white/5 bg-panel p-6 shadow-2xl md:p-8",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-accent/10 before:via-transparent before:to-transparent",
        className
      )}>
        {/* 背景装饰光晕 */}
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent/10 blur-[90px]" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4 md:gap-6">
            {Icon && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent md:h-14 md:w-14">
                <Icon className="h-6 w-6 md:h-7 md:w-7" />
              </div>
            )}
            <Animate
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="font-display text-3xl font-bold tracking-tight text-text md:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-text-mute md:mt-2.5 md:text-base max-w-2xl">
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
    <div className={cn("mb-8 flex flex-wrap items-center justify-between gap-6 px-1", className)}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-2 text-accent border border-border shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text md:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-text-mute/80">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
