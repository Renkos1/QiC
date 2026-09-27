import { z } from "zod";

/** Mirrors `minPasswordLength` in apps/api/src/auth/auth.ts. 与 api 的最短密码长度一致。 */
export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const email = z.email("请输入有效的邮箱地址");
const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `密码至少 ${MIN_PASSWORD_LENGTH} 位`)
  .max(MAX_PASSWORD_LENGTH, `密码最多 ${MAX_PASSWORD_LENGTH} 位`);

const passwordsMatch = (values: { password: string; confirmPassword: string }) =>
  values.password === values.confirmPassword;
const passwordsMismatch = { message: "两次输入的密码不一致", path: ["confirmPassword"] };

/** Sign-in form. 登录表单校验。 */
export const SignInSchema = z.object({
  email,
  password: z.string().min(1, "请输入密码"),
});

/** Sign-up form; passwords must match. 注册表单校验；两次密码必须一致。 */
export const SignUpSchema = z
  .object({
    name: z.string().trim().min(1, "请输入昵称").max(50, "昵称最多 50 个字符"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, passwordsMismatch);

/** Forgot-password form. 忘记密码表单校验。 */
export const ForgotPasswordSchema = z.object({ email });

/** Reset-password form; passwords must match. 重置密码表单校验；两次密码必须一致。 */
export const ResetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine(passwordsMatch, passwordsMismatch);

/** Sign-in form values. 登录表单值。 */
export type SignInValues = z.infer<typeof SignInSchema>;
/** Sign-up form values. 注册表单值。 */
export type SignUpValues = z.infer<typeof SignUpSchema>;
/** Forgot-password form values. 忘记密码表单值。 */
export type ForgotPasswordValues = z.infer<typeof ForgotPasswordSchema>;
/** Reset-password form values. 重置密码表单值。 */
export type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;
