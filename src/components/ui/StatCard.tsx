"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { Card } from "@/components/ui/Card";

export function StatCard({ label, value, hint, ...props }: { label: string; value: string; hint?: string } & HTMLMotionProps<"div">) {
  return (
    <Card className="flex flex-col gap-2 p-7" whileTap={{ scale: 0.98 }} {...props}>
      <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-mute opacity-80">{label}</p>
      <p className="text-4xl font-display font-medium tracking-tighter text-text tabular-nums leading-none mt-1">
        {value}
      </p>
      {hint ? <p className="text-xs text-mute/60 font-medium tracking-tight mt-auto pt-2">{hint}</p> : null}
    </Card>
  );
}
