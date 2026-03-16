"use client";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  compact?: boolean;
  align?: "left" | "center";
};

export function BrandMark({ className, compact = false, align = "left" }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5",
        align === "center" && "justify-center text-center",
        className
      )}
    >
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/35 shadow-[0_16px_32px_rgba(11,31,35,0.16)]",
          compact ? "h-11 w-11" : "h-14 w-14"
        )}
      >
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#1a4d57_0%,#11353d_58%,#0f2d33_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent_45%)] mix-blend-screen" />
        <div className="absolute inset-[1px] rounded-[17px] border border-white/10" />

        <svg
          width={compact ? 24 : 28}
          height={compact ? 24 : 28}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 text-white drop-shadow-md"
        >
          <path d="M12 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor" />
          <path d="M12 15L7 3.5c0 0 2-1 5-1s5 1 5 1L12 15Z" fill="white" fillOpacity="0.18" />
          <path
            d="M8.5 15L4 4.5M10.25 15L8 3M12 15V3M13.75 15L16 3M15.5 15L20 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M6 10c2 1 10 1 12 0M6.5 13c1.5 0.8 9.5 0.8 11 0"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.62"
          />
        </svg>
      </div>

      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.055em] text-text",
            compact ? "text-[1.35rem]" : "text-[1.85rem]"
          )}
        >
          羽痕
        </span>
        <span
          className={cn(
            "uppercase tracking-[0.22em] text-[color:var(--text-mute)]",
            compact ? "pt-1 text-[10px] font-semibold" : "pt-1.5 text-[11px] font-semibold"
          )}
        >
          Plume Scar
        </span>
      </div>
    </div>
  );
}
