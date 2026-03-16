import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Script from "next/script";

import { Providers } from "@/components/layout/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "羽痕 | Plume Scar",
  description: "记录羽毛球投入、装备收藏、心愿单和分析看板",
  icons: {
    icon: "/icon.png?v=gemini-a-v1",
    shortcut: "/icon.png?v=gemini-a-v1",
    apple: "/icon.png?v=gemini-a-v1",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";

  return (
    <html lang="zh-CN" data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var d=document.documentElement;var t=d.getAttribute('data-theme');if(t!=='light'&&t!=='dark'){t='light';d.setAttribute('data-theme','light');}localStorage.setItem('theme',t);var c=localStorage.getItem('color');if(c){d.setAttribute('data-color',c);}}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
