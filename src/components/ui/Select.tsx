import { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-lg border border-[color:var(--glass-border)] bg-panel2 px-3 py-2 text-sm text-text outline-none transition focus:border-neon/60 focus:ring-2 focus:ring-neon/20",
        props.className
      )}
    />
  );
}
