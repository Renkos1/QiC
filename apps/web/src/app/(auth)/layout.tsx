import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Centered layout for the public auth pages.
 *
 * 公开鉴权页面（登录、注册等）的居中布局。
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="font-semibold text-lg">
        QiC
      </Link>
      {children}
    </main>
  );
}
