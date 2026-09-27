"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@qic/ui/components/button";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { SignUpSchema, type SignUpValues } from "@/lib/auth-schemas";
import { useHydrated } from "@/lib/use-hydrated";

/** Where the verification link lands after Better Auth verifies the token. 邮件验证后落地的页面。 */
const VERIFIED_CALLBACK = "/verify-email?status=verified";

/**
 * Creates an account and asks the user to confirm their email.
 *
 * 注册账号，并提示用户去邮箱完成验证。
 */
export const SignUpForm = () => {
  const hydrated = useHydrated();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(SignUpSchema) });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: VERIFIED_CALLBACK,
    });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <FormAlert
        variant="default"
        message={`验证邮件已发送到 ${sentTo}，请点击邮件中的链接完成注册。`}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField
        id="name"
        label="昵称"
        autoComplete="nickname"
        error={errors.name}
        {...register("name")}
      />
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
        autoComplete="new-password"
        error={errors.password}
        {...register("password")}
      />
      <FormField
        id="confirmPassword"
        label="确认密码"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
        {...register("confirmPassword")}
      />
      <Button type="submit" disabled={!hydrated || isSubmitting}>
        {isSubmitting ? "正在注册…" : "注册"}
      </Button>
    </form>
  );
};
