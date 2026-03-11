import { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-text shadow-[var(--field-shadow)] outline-none transition placeholder:text-text-mute/60 focus:border-accent focus:bg-[var(--field-bg-focus)] focus:ring-4 focus:ring-accent/8",
        props.className
      )}
    />
  );
}
