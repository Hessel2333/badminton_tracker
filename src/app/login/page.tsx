"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "@/components/entry/BrandMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function normalizeCallbackPath(input?: string | null) {
  if (!input) return "/dashboard";

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3009";
    const url = new URL(input, base);
    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    if (nextPath === "/") return "/dashboard";
    return nextPath.startsWith("/") ? nextPath : "/dashboard";
  } catch {
    if (input === "/") return "/dashboard";
    return input.startsWith("/") ? input : "/dashboard";
  }
}

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
    setCallbackUrl(normalizeCallbackPath(params.get("callbackUrl")));
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

    window.location.assign(normalizeCallbackPath(result?.url ?? callbackUrl));
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
          </div>

          <div className="max-w-[28rem]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-mute)]">
              Private Archive
            </div>
            <h1 className="mt-4 max-w-[9ch] font-display text-[clamp(2.45rem,5vw,4.3rem)] leading-[0.95] tracking-[-0.07em] text-text">
              羽球档案台
            </h1>
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
                登录
              </h2>
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

          </form>
        </section>
      </div>
    </main>
  );
}
