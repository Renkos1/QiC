import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { SignInForm } from "./SignInForm";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "登录" };

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/**
 * `/sign-in`; `?next=` is honoured only for same-site paths.
 *
 * `/sign-in` 登录页；`?next=` 只接受站内相对路径（防开放重定向）。
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="登录"
      description="使用邮箱和密码登录"
      footer={
        <span>
          还没有账号？
          <Link href="/sign-up" className="underline underline-offset-4">
            注册
          </Link>
        </span>
      }
    >
      <SignInForm redirectTo={safeRedirectPath(next)} />
    </AuthCard>
  );
}
