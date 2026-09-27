import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "忘记密码" };

/**
 * `/forgot-password`: requests a reset email.
 *
 * `/forgot-password`：申请重置密码邮件。
 */
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="忘记密码"
      description="输入注册邮箱，我们会发送重置密码的链接"
      footer={
        <Link href="/sign-in" className="underline underline-offset-4">
          返回登录
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
