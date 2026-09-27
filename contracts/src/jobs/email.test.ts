/*
 * The send-email job payload schema.
 *
 * 发送邮件任务的负载 schema。
 */
import { describe, expect, it } from "vitest";
import { SendEmailJobSchema } from "./email.js";

const base = { to: "a@example.com", name: "Alice", url: "http://localhost:3000/x" };

describe("SendEmailJobSchema", () => {
  it("should accept the payload when the template is known", () => {
    expect(SendEmailJobSchema.parse({ template: "verify-email", ...base }).template).toBe(
      "verify-email",
    );
  });

  it("should reject the payload when the template is unknown", () => {
    expect(SendEmailJobSchema.safeParse({ template: "newsletter", ...base }).success).toBe(false);
  });

  it("should reject the payload when the recipient is not an email", () => {
    expect(
      SendEmailJobSchema.safeParse({ template: "reset-password", ...base, to: "nope" }).success,
    ).toBe(false);
  });
});
