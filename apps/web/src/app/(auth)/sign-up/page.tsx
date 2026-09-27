import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { SignUpForm } from "./SignUpForm";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "注册" };

/**
 * `/sign-up`: creates an account; sign-in waits for email verification.
 *
 * `/sign-up`：注册账号；验证邮箱后才能登录。
 */
export default function SignUpPage() {
  return (
    <AuthCard
      title="注册"
      description="注册后需要验证邮箱才能登录"
      footer={
        <span>
          已有账号？
          <Link href="/sign-in" className="underline underline-offset-4">
            登录
          </Link>
        </span>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
