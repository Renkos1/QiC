import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { getServerSession } from "@/lib/session";

/**
 * Every page in this group requires a verified session (the proxy only checks the cookie).
 *
 * 登录后区域的布局：这里在服务端真正校验会话（proxy 只检查 Cookie 是否存在），无效时跳转登录页。
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="min-h-dvh pb-16">
      <AppHeader email={session.user.email} />
      <main className="mx-auto mt-12 w-[min(820px,calc(100vw-2rem))]">{children}</main>
    </div>
  );
}
