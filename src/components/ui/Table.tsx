"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 现代高质感数据表格系统
 * 采用复合组件模式，提供灵活的排版控制与统一的主题响应
 */

export function Table({
    children,
    className,
    ...props
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"table">) {
    return (
        <div className="overflow-x-auto">
            <table className={cn("w-full text-left text-sm transition-colors", className)} {...props}>
                {children}
            </table>
        </div>
    );
}

export function TableHeader({
    children,
    className,
    ...props
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"thead">) {
    return (
        <thead className={cn("text-mute border-b border-border/60", className)} {...props}>
            {children}
        </thead>
    );
}

export function TableHead({
    children,
    className,
    ...props
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"th">) {
    return (
        <th className={cn("pb-3 text-xs uppercase tracking-wider font-semibold", className)} {...props}>
            {children}
        </th>
    );
}

export function TableBody({
    children,
    className,
    ...props
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"tbody">) {
    return (
        <tbody className={cn("", className)} {...props}>
            {children}
        </tbody>
    );
}

export function TableRow({
    children,
    className,
    ...props
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"tr">) {
    return (
        <tr className={cn("border-b border-border/30 last:border-0 hover:bg-border/10 transition-colors", className)} {...props}>
            {children}
        </tr>
    );
}

export function TableCell({
    children,
    className,
    ...props
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"td">) {
    return (
        <td className={cn("py-3", className)} {...props}>
            {children}
        </td>
    );
}
