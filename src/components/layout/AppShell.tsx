"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  BookText,
  ShieldCheck,
  GalleryHorizontal,
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
  { href: "/purchases", label: "项目装备库", icon: Receipt },
  { href: "/purchases/ledger", label: "购买台账", icon: BookText },
  { href: "/gear-wall", label: "装备墙", icon: ShieldCheck },
  { href: "/gear-board", label: "洞洞板", icon: GalleryHorizontal },
  { href: "/analytics", label: "分析看板", icon: BarChart3 },
  { href: "/settings", label: "设置", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  });
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
    const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    document.cookie = `theme=${nextTheme}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }

  return (
    <div className="relative min-h-screen bg-bg text-text selection:bg-accent/30 selection:text-white">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute left-[-10%] top-[-12%] h-[34rem] w-[34rem] rounded-full bg-white/50 blur-[110px]" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div className="mx-auto grid w-full max-w-[1420px] grid-cols-1 gap-10 px-5 py-6 md:grid-cols-[248px_minmax(0,1fr)] md:px-7 lg:gap-12 lg:px-8">
        <aside className="sticky top-6 h-fit transform-gpu">
          <div className="material-blur rounded-[34px] p-3.5">
            <Link href="/dashboard" className="group mb-3 flex items-center gap-3.5 px-2.5 py-1.5">
            <motion.div
              whileHover={{ scale: 1.04, rotate: -3 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] border border-white/30 bg-[color:var(--panel-3)] shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent to-[var(--accent-dark,#0f766e)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.32),transparent_45%)] mix-blend-overlay" />
              <div className="absolute inset-0 rounded-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />

              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 text-white drop-shadow-md">
                <path d="M12 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor" />
                <path d="M12 15L7 3.5c0 0 2-1 5-1s5 1 5 1L12 15Z" fill="white" fillOpacity="0.2" />
                <path d="M8.5 15L4 4.5M10.25 15L8 3M12 15V3M13.75 15L16 3M15.5 15L20 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 10c2 1 10 1 12 0M6.5 13c1.5 0.8 9.5 0.8 11 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              </svg>
            </motion.div>

            <div className="flex flex-col justify-center -space-y-0.5">
              <span className="font-display text-[1.35rem] font-semibold leading-tight tracking-[-0.045em] text-text">
                羽痕
              </span>
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-text-mute">
                Plume Scar
              </span>
            </div>
          </Link>

          <nav className="space-y-1.5 rounded-[28px] p-1.5">
            {nav.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm transition-all",
                    active
                      ? "font-semibold text-text"
                      : "font-medium text-text-mute hover:bg-black/[0.035] hover:text-text"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 rounded-[22px] border border-white/35 bg-[color:var(--panel-3)] shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={18} className={cn("relative transition-colors", active ? "text-accent" : "text-text-mute group-hover:text-text")} />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 flex items-center gap-2 px-1.5">
            <button
              type="button"
              className="group flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[var(--border)] bg-[color:var(--panel-2)] text-text-mute shadow-[inset_0_1px_0_var(--glass-border)] transition-all hover:border-[var(--border-strong)] hover:text-text"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[color:var(--panel-2)] px-4 text-text-mute shadow-[inset_0_1px_0_var(--glass-border)] transition-all hover:border-[var(--danger-soft-border)] hover:bg-[var(--danger-soft-bg)] hover:text-[var(--danger-soft-text)]"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={16} />
              <span className="text-sm">退出登录</span>
            </button>
          </div>
          </div>
        </aside>

        <main className="min-h-[calc(100vh-4rem)] pt-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
