/*
 * Mapping of Better Auth error codes to Chinese copy.
 *
 * Better Auth 错误码到中文文案的映射。
 */
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("should map a known Better Auth code to Chinese copy", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("邮箱或密码错误");
  });

  it("should tell unverified users that a new email was sent", () => {
    expect(authErrorMessage({ code: "EMAIL_NOT_VERIFIED" })).toContain("重新发送验证邮件");
  });

  it.each([[{ code: "SOMETHING_NEW" }], [{}], [null], [undefined]])(
    "should fall back to generic copy when the error is %j",
    (error) => {
      expect(authErrorMessage(error)).toBe("操作失败，请稍后重试");
    },
  );
});
