import "@fontsource-variable/outfit";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

/**
 * Site-wide title template and description.
 *
 * 全站标题模板与描述。
 */
export const metadata: Metadata = {
  title: { default: "QiC", template: "%s · QiC" },
  description: "社区与简易智能硬件工作区",
};

/**
 * Root HTML shell: self-hosted fonts, theme and React Query provider.
 *
 * 根 HTML 外壳：自托管字体、主题样式和 React Query 提供者。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={GeistMono.variable}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
