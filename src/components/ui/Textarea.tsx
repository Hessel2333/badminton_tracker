import { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-[20px] border border-[var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-[15px] text-text shadow-[var(--field-shadow)] outline-none backdrop-blur-xl transition-[background,border-color,box-shadow] placeholder:text-text-mute/60 focus:border-accent/45 focus:bg-[var(--field-bg-focus)] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.08)]",
        props.className
      )}
    />
  );
}
