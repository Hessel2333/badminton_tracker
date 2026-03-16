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
                "relative mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--border)] bg-[color:var(--panel)] p-1.5 backdrop-blur-2xl shadow-[0_16px_38px_rgba(15,23,42,0.08)] md:gap-4 md:rounded-[30px]",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-[30px] before:border before:border-white/30 before:opacity-50",
                className
            )}
        >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {left || children}
            </div>
            {right && (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap sm:gap-3">
                    {right}
                </div>
            )}
        </div>
    );
}
