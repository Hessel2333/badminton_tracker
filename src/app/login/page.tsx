"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, GalleryHorizontal, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/entry/BrandMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");

  useEffect(() => {
    const domTheme = document.documentElement.getAttribute("data-theme");
    if (domTheme === "light" || domTheme === "dark") {
      window.localStorage.setItem("theme", domTheme);
    }

    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get("callbackUrl") ?? "/dashboard");
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      username,
      password,
      callbackUrl,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError("账号或密码错误");
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 md:py-6">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg)_95%,white)_0%,var(--bg)_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_14%,color-mix(in_srgb,var(--accent)_11%,transparent)_0,transparent_26%),radial-gradient(circle_at_84%_12%,color-mix(in_srgb,var(--bg-elevated)_70%,white)_0,transparent_22%),radial-gradient(circle_at_50%_80%,color-mix(in_srgb,var(--text)_6%,transparent)_0,transparent_26%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid bg-[size:38px_38px] opacity-[0.1]" />

      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-[1360px] gap-8 rounded-[38px] border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-elevated)_92%,white)_0%,color-mix(in_srgb,var(--bg-elevated)_98%,var(--bg))_100%)] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.09)] backdrop-blur-2xl md:p-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(370px,0.98fr)] lg:gap-10 lg:p-8">
        <section className="relative flex flex-col overflow-hidden rounded-[32px] border border-[color:color-mix(in_srgb,var(--accent)_12%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-3)_90%,white)_0%,color-mix(in_srgb,var(--panel-2)_95%,var(--bg))_100%)] p-6 shadow-[inset_0_1px_0_var(--glass-border)] md:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <BrandMark />
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[color:var(--text-mute)] transition-colors duration-200 hover:border-[var(--border-strong)] hover:bg-[color:var(--panel-2)] hover:text-text"
            >
              <ArrowLeft size={15} />
              返回首页
            </Link>
          </div>

          <div className="max-w-[34rem]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-mute)]">
              Private Archive Login
            </div>
            <h1 className="mt-4 max-w-[9ch] font-display text-[clamp(2.45rem,5vw,4.3rem)] leading-[0.95] tracking-[-0.07em] text-text">
              登录后继续维护你的羽球轨迹。
            </h1>
            <p className="mt-5 max-w-[27rem] text-[15px] leading-8 text-[color:color-mix(in_srgb,var(--text)_74%,var(--text-mute)_26%)] md:text-[16px]">
              进入后先看档案状态，再去装备墙、洞洞板和分析看板继续整理。
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_6%,var(--panel-2))] px-4 py-2 text-sm text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-mute)_12%)]">
              <ShieldCheck className="h-4 w-4 text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]" />
              装备墙：先看状态
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_6%,var(--panel-2))] px-4 py-2 text-sm text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-mute)_12%)]">
              <GalleryHorizontal className="h-4 w-4 text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]" />
              洞洞板：再看陈列
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_6%,var(--panel-2))] px-4 py-2 text-sm text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-mute)_12%)]">
              <BarChart3 className="h-4 w-4 text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]" />
              分析看板：最后做判断
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <form
            onSubmit={onSubmit}
            className="w-full rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-3)_90%,white)_0%,color-mix(in_srgb,var(--panel)_98%,var(--bg))_100%)] p-6 shadow-[0_24px_64px_rgba(15,23,42,0.08),inset_0_1px_0_var(--glass-border)] backdrop-blur-3xl md:p-8"
          >
            <div className="border-b border-[var(--border)] pb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-mute)]">
                Sign In
              </div>
              <h2 className="mt-3 font-display text-[2rem] font-semibold tracking-[-0.05em] text-text">
                欢迎回来
              </h2>
              <p className="mt-2 text-sm leading-7 text-[color:var(--text-mute)]">
                登录后继续管理装备、购买记录、心愿单与分析视图。
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm text-[color:var(--text-mute)]">
                  用户名
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-[color:var(--text-mute)]">
                  密码
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <p className="rounded-[18px] border border-[var(--danger-soft-border)] bg-[var(--danger-soft-bg)] px-4 py-3 text-sm text-[var(--danger-soft-text)]">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={loading} className="mt-2 w-full gap-2">
                {loading ? "登录中..." : "进入控制台"}
                {!loading ? <ArrowRight size={16} /> : null}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 border-t border-[var(--border)] pt-5 text-xs leading-6 text-[color:var(--text-mute)]">
              <div className="flex items-center justify-between gap-4">
                <span>登录后默认跳转</span>
                <span className="font-medium text-text">/dashboard</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>入口定位</span>
                <span className="font-medium text-text">单账号私域工作台</span>
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
