"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  GalleryHorizontal,
  Heart,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun
} from "lucide-react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "总览", icon: LayoutDashboard },
  { href: "/purchases", label: "新增购买", icon: Receipt },
  { href: "/purchases/ledger", label: "购买台账", icon: Receipt },
  { href: "/gear-wall", label: "装备墙", icon: ShieldCheck },
  { href: "/gear-board", label: "洞洞板", icon: GalleryHorizontal },
  { href: "/wishlist", label: "心愿单", icon: Heart },
  { href: "/analytics", label: "分析看板", icon: BarChart3 },
  { href: "/settings", label: "设置", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const activeHref = useMemo(() => {
    let best = "";
    for (const item of nav) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (item.href.length > best.length) {
          best = item.href;
        }
      }
    }
    return best;
  }, [pathname]);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const nextTheme = stored === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("theme", nextTheme);
  }

  return (
    <div className="relative min-h-screen bg-bg text-text selection:bg-accent/30 selection:text-white">
      {/* Subtle Depth Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-15%] left-[-10%] h-[50%] w-[50%] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/5 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 material-blur border-b border-border shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20 transition-all group-hover:scale-105 group-hover:-rotate-3">
              <svg viewBox="0 0 64 64" className="h-5 w-5 text-accent-foreground" aria-hidden="true">
                <circle cx="32" cy="49" r="10" fill="currentColor" opacity="0.95" />
                <path d="M18 8 28 42H22L14 12c-.7-2.6 2.8-4.5 4-2.3Z" fill="currentColor" />
                <path d="M32 4 36 42h-8l4-38Z" fill="currentColor" />
                <path d="m46 8 4 1.7c1.7.8 2.5 2.8 1.9 4.6L42 42h-6L46 8Z" fill="currentColor" />
                <path d="M23 42h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
              </svg>
            </div>
            <span className="font-display text-2xl tracking-tight font-extrabold text-text">羽阵档案</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="group h-10 w-10 flex items-center justify-center rounded-2xl border border-border bg-panel hover:bg-border/30 transition-all text-text-mute hover:text-text"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 h-10 px-4 rounded-2xl border border-border bg-panel text-text-mute font-medium transition-all hover:bg-red-50 hover:text-red-500 hover:border-red-100 dark:hover:bg-red-950/20 dark:hover:border-red-900/50"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={16} />
              <span className="text-sm">退出登录</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-6 py-10 md:grid-cols-[260px_1fr]">
        <aside className="h-fit sticky top-28">
          <nav className="space-y-2.5 p-2 bg-panel/40 rounded-[32px] border border-border">
            {nav.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[20px] px-5 py-3.5 text-sm font-semibold transition-all group",
                    active
                      ? "text-accent bg-border/20 shadow-inner"
                      : "text-text-mute hover:text-text hover:bg-border/10"
                  )}
                >
                  <Icon size={20} className={cn("transition-colors", active ? "text-accent" : "text-text-mute group-hover:text-text")} />
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 w-1 h-5 bg-accent rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-[calc(100vh-16rem)]">
          <AnimatePresence mode="sync">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
