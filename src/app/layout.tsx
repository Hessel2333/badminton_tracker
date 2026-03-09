import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/layout/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "羽阵档案",
  description: "记录羽毛球投入、装备收藏、心愿单和分析看板"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      {/* 阻塞式主题初始化：在 HTML 解析阶段读取 localStorage，避免 FOUC */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`
        }}
      />
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
