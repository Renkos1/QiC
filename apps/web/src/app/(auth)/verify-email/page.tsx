import { Button } from "@qic/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/FormAlert";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "邮箱验证" };

interface VerifyEmailPageProps {
  // Better Auth redirects here after checking the token: ?status=verified or ?error=<code>.
  searchParams: Promise<{ status?: string | string[]; error?: string | string[] }>;
}

/**
 * `/verify-email`: result page Better Auth redirects to after checking the link.
 *
 * `/verify-email`：Better Auth 校验邮件链接后跳转到的结果页。
 */
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { status, error } = await searchParams;
  const verified = status === "verified" && !error;

  return (
    <AuthCard title="邮箱验证">
      {verified ? (
        <div className="grid gap-4">
          <FormAlert variant="default" message="邮箱验证成功，你已自动登录。" />
          <Button asChild>
            <Link href="/">进入社区</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <FormAlert message="验证链接无效或已过期。重新登录即可收到新的验证邮件。" />
          <Button asChild variant="outline">
            <Link href="/sign-in">去登录</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
