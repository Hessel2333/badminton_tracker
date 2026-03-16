"use client";

import React, { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Option {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface SegmentedControlProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    size?: "sm" | "md";
    fullWidth?: boolean;
}

export function SegmentedControl({
    options,
    value,
    onChange,
    className,
    size = "md",
    fullWidth = false,
}: SegmentedControlProps) {
    const segmentedLayoutId = useId();

    return (
        <div
            className={cn(
                "relative flex rounded-full border border-[var(--border)] bg-[color:var(--panel)] p-1 shadow-[inset_0_1px_0_var(--glass-border)] backdrop-blur-2xl",
                fullWidth ? "w-full" : "w-fit",
                className
            )}
        >
            {options.map((option) => {
                const isActive = value === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onChange(option.id)}
                        className={cn(
                            "relative z-10 flex items-center justify-center gap-2 rounded-full transition-colors duration-200",
                            size === "sm" ? "px-3 py-1 text-xs" : "px-4.5 py-1.5 text-sm",
                            fullWidth ? "flex-1" : "min-w-[80px]",
                            isActive ? "text-text font-semibold" : "text-text-mute hover:text-text"
                        )}
                    >
                        {option.icon && <span className="shrink-0">{option.icon}</span>}
                        <span className="relative z-10">{option.label}</span>

                        {isActive && (
                            <motion.div
                                layoutId={`segmented-active-${segmentedLayoutId}`}
                                className="absolute inset-0 z-0 rounded-full border border-[var(--border)] bg-[color:var(--panel-3)] shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30,
                                }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
