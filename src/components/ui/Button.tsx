"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  const variants = {
    primary:
      "border border-transparent bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_82%,white)_0%,var(--accent)_100%)] text-accent-foreground shadow-[0_10px_24px_rgba(0,113,227,0.22)] hover:brightness-[1.03]",
    secondary:
      "border border-[var(--border)] bg-[color:var(--panel-2)] text-text shadow-[inset_0_1px_0_var(--glass-border)] hover:border-[var(--border-strong)] hover:bg-[color:var(--panel-3)]",
    ghost: "border border-transparent bg-transparent text-[color:var(--text-mute)] hover:bg-black/[0.04] hover:text-text",
    danger:
      "border border-transparent bg-[linear-gradient(180deg,#ef5b52_0%,#d92d20_100%)] text-white shadow-[0_10px_22px_rgba(217,45,32,0.18)] hover:brightness-[1.02]",
  };

  const sizes = {
    sm: "min-h-9 px-3.5 text-xs rounded-full",
    md: "min-h-11 px-4.5 text-sm rounded-full",
    lg: "min-h-12 px-6 text-base rounded-full",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.008 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] transition-[background,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/12 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
