"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-glow" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid bg-[size:32px_32px] opacity-20" />

      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-panel/90 p-6 shadow-panel backdrop-blur md:p-8"
      >
        <p className="font-display text-xl tracking-[0.1em] text-neon">
          羽痕 <span className="ml-2 text-sm tracking-widest text-accent uppercase font-sans">Plume Scar</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-text">系统控制台登录</h1>
        <p className="mt-1 text-sm text-mute">单用户模式，保护你的投入与装备数据。</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-mute">
              用户名
            </label>
            <Input
              id="username"
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-mute">
              密码
            </label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "登录中..." : "进入控制台"}
          </Button>
        </div>
      </form>
    </main>
  );
}
