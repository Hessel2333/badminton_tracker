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
                "relative mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[30px] border border-[var(--border)] bg-[color:var(--panel)] p-1.5 backdrop-blur-2xl shadow-[0_16px_38px_rgba(15,23,42,0.08)]",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-[30px] before:border before:border-white/30 before:opacity-50",
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
