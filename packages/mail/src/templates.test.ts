/*
 * Email templates: content, links and HTML escaping of user input.
 *
 * 邮件模板：内容、链接，以及用户输入的 HTML 转义。
 */
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderResetPassword,
  renderTodoCompleted,
  renderVerifyEmail,
} from "./templates.js";

const url = "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2F";

describe("renderVerifyEmail", () => {
  it("should include the action url in both text and html bodies", () => {
    const email = renderVerifyEmail({ name: "Alice", url });
    expect(email.text).toContain(url);
    expect(email.html).toContain(escapeHtml(url));
    expect(email.subject).toContain("验证");
  });

  it("should escape the name when it contains html", () => {
    const email = renderVerifyEmail({ name: "<script>x</script>", url });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("renderResetPassword", () => {
  it("should produce a reset subject when rendering a reset email", () => {
    expect(renderResetPassword({ name: "Bob", url }).subject).toContain("重置");
  });
});

describe("renderTodoCompleted", () => {
  it("should escape the title when it contains html", () => {
    const email = renderTodoCompleted({ name: "A", url, title: "<b>x</b>" });
    expect(email.html).not.toContain("<b>x</b>");
    expect(email.text).toContain("<b>x</b>");
    expect(email.subject).toBe("已完成：<b>x</b>");
  });
});
