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
  { href: "/purchases/ledger", label: "购买台账", icon: BookText },
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
        <div className="absolute bottom-[-15%] right-[-10%] h-[50%] w-[50%] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-6 py-10 md:grid-cols-[240px_1fr]">
        <aside className="h-fit sticky top-10 flex flex-col gap-8 transform-gpu">
          <Link href="/dashboard" className="flex items-center gap-3.5 group px-2 mb-2">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -4 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] overflow-hidden shadow-lg shadow-accent/20 border border-[rgba(255,255,255,0.1)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent to-[var(--accent-dark,#0f766e)]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent)] mix-blend-overlay" />
              <div className="absolute inset-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] rounded-[14px]" />

              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 text-white drop-shadow-md">
                <path d="M12 21.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="currentColor" />
                <path d="M4 3L10.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 3L13.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 3L11.25 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                <path d="M16 3L12.75 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              </svg>
            </motion.div>

            <div className="flex flex-col justify-center -space-y-0.5">
              <span className="font-display text-xl leading-tight tracking-widest font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-text to-text-mute/80">
                羽痕
              </span>
              <span className="text-[10px] font-bold tracking-[0.15em] text-accent font-sans uppercase">
                Plume Scar
              </span>
            </div>
          </Link>

          <nav className="space-y-2 p-2 bg-panel/60 backdrop-blur-3xl rounded-[32px] border border-border/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            {nav.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[24px] px-5 py-3.5 text-sm transition-all group",
                    active
                      ? "text-white shadow-sm font-bold"
                      : "text-text-mute font-medium hover:text-text hover:bg-border/40"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 rounded-[24px] bg-accent shadow-md shadow-accent/20"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={20} className={cn("relative transition-colors", active ? "text-white" : "text-text-mute group-hover:text-text")} />
                  <span className={cn("relative", active ? "tracking-wide" : "")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 px-3">
            <button
              type="button"
              className="group h-[46px] w-[46px] flex items-center justify-center rounded-[18px] border border-border/80 bg-panel/60 hover:bg-border/30 transition-all text-text-mute hover:text-text shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 h-[46px] px-4 rounded-[18px] border border-border/80 bg-panel/60 text-text-mute font-medium transition-all hover:bg-[var(--danger-soft-bg)] hover:text-[var(--danger-soft-text)] hover:border-[var(--danger-soft-border)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={16} />
              <span className="text-sm">退出登录</span>
            </button>
          </div>
        </aside>

        <main className="min-h-[calc(100vh-5rem)]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
