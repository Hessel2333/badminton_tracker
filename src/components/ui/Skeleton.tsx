"use client";

import { cn } from "@/lib/utils";

export function Skeleton({
    className
}: {
    className?: string
}) {
    return (
        <div className={cn("shimmer-bg rounded-lg", className)} />
    );
}

export function TableSkeleton({
    rows = 5,
    cols = 4
}: {
    rows?: number;
    cols?: number
}) {
    return (
        <div className="w-full space-y-4">
            <div className="flex gap-4 border-b border-border/60 pb-3">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1 opacity-60" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3 border-b border-border/10 last:border-0">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-5 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}
