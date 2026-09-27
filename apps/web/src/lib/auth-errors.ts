// Better Auth error codes surfaced in the UI, mapped to user-facing copy.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "邮箱或密码错误",
  EMAIL_NOT_VERIFIED: "邮箱尚未验证。我们已重新发送验证邮件，请查收后再登录。",
  USER_ALREADY_EXISTS: "该邮箱已注册，请直接登录",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "该邮箱已注册，请直接登录",
  PASSWORD_TOO_SHORT: "密码太短",
  PASSWORD_TOO_LONG: "密码太长",
  INVALID_TOKEN: "链接无效或已过期，请重新申请",
};

const FALLBACK = "操作失败，请稍后重试";

/**
 * Returns user-facing copy for a Better Auth error; never shows raw server messages.
 *
 * 把 Better Auth 错误码转换为中文提示；未知错误显示通用文案，不展示服务端原始信息。
 */
export const authErrorMessage = (error: { code?: string | undefined } | null | undefined) =>
  (error?.code && MESSAGES[error.code]) || FALLBACK;
