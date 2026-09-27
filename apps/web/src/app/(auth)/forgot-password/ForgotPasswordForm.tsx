"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@qic/ui/components/button";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { ForgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth-schemas";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Requests a password-reset email; always shows the same success copy so accounts cannot be probed.
 *
 * 申请重置密码邮件；无论邮箱是否存在都显示相同提示，防止探测账号。
 */
export const ForgotPasswordForm = () => {
  const hydrated = useHydrated();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(ForgotPasswordSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setSubmitted(true);
  });

  if (submitted) {
    // Same message whether or not the account exists, so emails cannot be enumerated.
    return (
      <FormAlert
        variant="default"
        message="如果该邮箱已注册，你将收到一封重置密码的邮件，请查收。"
      />
    );
  }

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
      <Button type="submit" disabled={!hydrated || isSubmitting}>
        {isSubmitting ? "正在发送…" : "发送重置邮件"}
      </Button>
    </form>
  );
};
