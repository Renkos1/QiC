"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@qic/ui/components/button";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { ResetPasswordSchema, type ResetPasswordValues } from "@/lib/auth-schemas";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Sets a new password using the token from the reset email.
 *
 * 使用重置邮件中的令牌设置新密码。
 *
 * @param props.token - Token from the reset link. 重置链接中的令牌。
 */
export const ResetPasswordForm = ({ token }: { token: string }) => {
  const hydrated = useHydrated();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(ResetPasswordSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setDone(true);
  });

  if (done) {
    return (
      <div className="grid gap-4">
        <FormAlert variant="default" message="密码已重置，所有设备上的登录都已失效。" />
        <Button asChild>
          <Link href="/sign-in">使用新密码登录</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField
        id="password"
        label="新密码"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        {...register("password")}
      />
      <FormField
        id="confirmPassword"
        label="确认新密码"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
        {...register("confirmPassword")}
      />
      <Button type="submit" disabled={!hydrated || isSubmitting}>
        {isSubmitting ? "正在保存…" : "重置密码"}
      </Button>
    </form>
  );
};
