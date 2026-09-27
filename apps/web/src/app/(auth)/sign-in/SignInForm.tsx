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
import { SignInSchema, type SignInValues } from "@/lib/auth-schemas";
import { hardNavigate } from "@/lib/navigation";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Email + password sign-in; unverified accounts get a fresh verification email.
 *
 * 邮箱密码登录；未验证的账号会收到新的验证邮件。
 *
 * @param props.redirectTo - Same-site path to open after sign-in. 登录后跳转的站内路径。
 */
export const SignInForm = ({ redirectTo }: { redirectTo: string }) => {
  const hydrated = useHydrated();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(SignInSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    // A full load, not router.replace: see hardNavigate.
    hardNavigate(redirectTo);
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField
        id="email"
        label="邮箱"
        type="email"
        autoComplete="email"
        error={errors.email}
        {...register("email")}
      />
      <FormField
        id="password"
        label="密码"
        type="password"
        autoComplete="current-password"
        error={errors.password}
        {...register("password")}
      />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          忘记密码？
        </Link>
      </div>
      <Button type="submit" disabled={!hydrated || isSubmitting}>
        {isSubmitting ? "正在登录…" : "登录"}
      </Button>
    </form>
  );
};
