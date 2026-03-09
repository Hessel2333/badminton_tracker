import { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-[color:var(--glass-border)] bg-panel2 px-3 py-2 text-sm text-text outline-none transition placeholder:text-mute focus:border-neon/60 focus:ring-2 focus:ring-neon/20",
        props.className
      )}
    />
  );
}
