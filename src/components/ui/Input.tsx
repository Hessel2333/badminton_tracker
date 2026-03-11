import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-4 py-2 text-sm text-text shadow-[var(--field-shadow)] transition-all placeholder:text-text-mute/60 focus:border-accent focus:bg-[var(--field-bg-focus)] focus:ring-4 focus:ring-accent/5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
