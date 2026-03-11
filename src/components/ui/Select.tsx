"use client";

import { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  disabled,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="group relative">
      <select
        {...props}
        disabled={disabled}
        className={cn(
          "select-ui h-11 w-full appearance-none rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-4 pr-11 text-sm font-medium text-text shadow-[var(--field-shadow)] outline-none transition-all duration-200 hover:border-accent/35 hover:shadow-[0_10px_28px_rgba(5,150,105,0.08)] focus:border-accent focus:bg-[var(--field-bg-focus)] focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center">
        <span className="rounded-full border border-[var(--field-border)] bg-[var(--field-icon-bg)] p-1 text-text-mute transition-colors duration-200 group-hover:border-accent/30 group-hover:text-accent group-focus-within:border-accent/40 group-focus-within:text-accent">
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </span>
    </div>
  );
}
