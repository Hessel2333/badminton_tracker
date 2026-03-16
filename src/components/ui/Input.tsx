import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-[18px] border border-[var(--field-border)] bg-[var(--field-bg)] px-4 py-2 text-[15px] text-text shadow-[var(--field-shadow)] backdrop-blur-xl transition-[background,border-color,box-shadow,color] placeholder:text-text-mute/60 focus:border-accent/45 focus:bg-[var(--field-bg-focus)] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.08)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
