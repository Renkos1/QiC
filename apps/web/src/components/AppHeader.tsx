import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

/**
 * Floating journal-style navigation bar shown on signed-in pages.
 *
 * 登录后页面顶部的悬浮导航栏（工程日志风格），显示当前账号和退出按钮。
 *
 * @param props.email - Signed-in user's email. 当前用户邮箱。
 */
export const AppHeader = ({ email }: { email: string }) => (
  <header className="sticky top-4 z-10 mx-auto flex w-[min(820px,calc(100vw-2rem))] items-center gap-4 rounded-md border bg-[rgb(236_233_227/0.95)] py-1.5 pr-1.5 pl-4 shadow-[0_8px_24px_rgb(36_33_29/0.08)] backdrop-blur-md">
    <Link href="/" className="font-medium tracking-tight">
      QiC
    </Link>
    <span className="journal-kicker hidden flex-1 text-center sm:block">COMMUNITY / WORKSPACE</span>
    <span className="ml-auto truncate text-muted-foreground text-sm sm:ml-0">{email}</span>
    <SignOutButton />
  </header>
);
