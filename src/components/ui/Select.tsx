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
          "select-ui h-11 w-full appearance-none rounded-[18px] border border-[var(--field-border)] bg-[var(--field-bg)] px-4 pr-11 text-[15px] font-medium text-text shadow-[var(--field-shadow)] outline-none backdrop-blur-xl transition-[background,border-color,box-shadow] duration-200 hover:border-[var(--border-strong)] focus:border-accent/45 focus:bg-[var(--field-bg-focus)] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.08)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center">
        <span className="rounded-full border border-[var(--field-border)] bg-[var(--field-icon-bg)] p-1 text-text-mute transition-colors duration-200 group-hover:border-[var(--border-strong)] group-hover:text-text group-focus-within:border-accent/35 group-focus-within:text-accent">
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </span>
    </div>
  );
}
