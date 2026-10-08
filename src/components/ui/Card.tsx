"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  entryAnimation?: boolean;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileTap?: unknown;
  whileHover?: unknown;
};

export function Card({
  children,
  className,
  entryAnimation: _entryAnimation,
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  whileTap: _whileTap,
  whileHover: _whileHover,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "card-gradient rounded-[28px] p-6 md:p-7",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
