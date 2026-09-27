import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/FormAlert";
import { ResetPasswordForm } from "./ResetPasswordForm";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "重置密码" };

interface ResetPasswordPageProps {
  // Better Auth redirects here with ?token=… on success or ?error=INVALID_TOKEN.
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}

/**
 * `/reset-password`: sets a new password from the emailed token, or explains an invalid link.
 *
 * `/reset-password`：用邮件中的令牌设置新密码；链接无效时给出说明。
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const validToken = typeof token === "string" && token.length > 0 && !error ? token : null;

  return (
    <AuthCard
      title="重置密码"
      footer={
        <Link href="/sign-in" className="underline underline-offset-4">
          返回登录
        </Link>
      }
    >
      {validToken ? (
        <ResetPasswordForm token={validToken} />
      ) : (
        <div className="grid gap-4">
          <FormAlert message="重置链接无效或已过期，请重新申请。" />
          <Link href="/forgot-password" className="text-sm underline underline-offset-4">
            重新发送重置邮件
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
