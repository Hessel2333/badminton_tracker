import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

import { Providers } from "@/components/layout/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "羽痕 | Plume Scar",
  description: "记录羽毛球投入、装备收藏、心愿单和分析看板"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');var c=localStorage.getItem('color');if(c){document.documentElement.setAttribute('data-color',c);}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
