import React from "react";
import { cn } from "@/lib/utils";

interface ControlPanelProps {
    children: React.ReactNode;
    className?: string;
    left?: React.ReactNode;
    right?: React.ReactNode;
}

export function ControlPanel({ children, className, left, right }: ControlPanelProps) {
    return (
        <div
            className={cn(
                "mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-border bg-panel/60 p-1 backdrop-blur-xl shadow-sm",
                "relative before:absolute before:inset-0 before:rounded-[28px] before:border-t before:border-white/20 before:pointer-events-none",
                className
            )}
        >
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {left || children}
            </div>
            {right && (
                <div className="flex items-center gap-3 shrink-0">
                    {right}
                </div>
            )}
        </div>
    );
}
