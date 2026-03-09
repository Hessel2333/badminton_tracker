import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text transition-all placeholder:text-text-mute/60 focus:border-accent focus:bg-panel-2 focus:ring-4 focus:ring-accent/5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
