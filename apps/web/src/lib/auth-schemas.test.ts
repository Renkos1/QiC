/*
 * Auth form schemas: email format, password length, matching confirmation.
 *
 * 鉴权表单校验：邮箱格式、密码长度、两次输入一致。
 */
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors.js";
import { ResetPasswordSchema, SignUpSchema } from "./auth-schemas.js";

const valid = {
  name: "Alice",
  email: "alice@example.com",
  password: "password-123",
  confirmPassword: "password-123",
};

describe("SignUpSchema", () => {
  it("should accept the values when all fields are valid", () => {
    expect(SignUpSchema.safeParse(valid).success).toBe(true);
  });

  it("should flag confirmPassword when the passwords differ", () => {
    const result = SignUpSchema.safeParse({ ...valid, confirmPassword: "other-password" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("should reject the password when it is shorter than the minimum", () => {
    const result = SignUpSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("ResetPasswordSchema", () => {
  it("should accept matching passwords when they meet the minimum length", () => {
    expect(
      ResetPasswordSchema.safeParse({ password: "new-password", confirmPassword: "new-password" })
        .success,
    ).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("should map a known code when the error has one", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("邮箱或密码错误");
  });

  it("should fall back to generic copy when the code is unknown", () => {
    expect(authErrorMessage({ code: "SOMETHING_ELSE" })).toBe("操作失败，请稍后重试");
  });
});
