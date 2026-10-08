"use client";

import type { HTMLAttributes } from "react";

type AnimateProps = HTMLAttributes<HTMLDivElement> & {
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
};

export function Animate({
    children,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    ...props
}: AnimateProps) {
    return <div {...props}>{children}</div>;
}
