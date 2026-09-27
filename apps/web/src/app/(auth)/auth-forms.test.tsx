// @vitest-environment jsdom
/*
 * Sign-in, sign-up, forgot- and reset-password forms in jsdom. The Better Auth client
 * and page navigation are faked; validation and error copy are real.
 *
 * 登录、注册、忘记密码、重置密码表单（jsdom）。Better Auth 客户端与页面跳转为假实现，
 * 表单校验与错误文案是真实的。
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import "@/test/render";
import { ForgotPasswordForm } from "./forgot-password/ForgotPasswordForm";
import { ResetPasswordForm } from "./reset-password/ResetPasswordForm";
import { SignInForm } from "./sign-in/SignInForm";
import { SignUpForm } from "./sign-up/SignUpForm";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

const hardNavigate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation", () => ({ hardNavigate }));

const ok = { data: {}, error: null } as never;
const failed = (code: string) => ({ data: null, error: { code } }) as never;

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("before hydration", () => {
  // A native (pre-hydration) submit is a GET that would put credentials into the URL.
  it.each([
    ["SignInForm", <SignInForm key="in" redirectTo="/" />],
    ["SignUpForm", <SignUpForm key="up" />],
    ["ForgotPasswordForm", <ForgotPasswordForm key="forgot" />],
    ["ResetPasswordForm", <ResetPasswordForm key="reset" token="t" />],
  ])("should server-render %s with its submit button disabled", (_name, form) => {
    const html = new DOMParser().parseFromString(renderToString(form), "text/html");
    const submit = html.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(true);
  });
});

describe("SignInForm", () => {
  it("should go to the requested page when sign-in succeeds", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce(ok);
    render(<SignInForm redirectTo="/examples/todos" />);
    type("邮箱", "a@example.com");
    type("密码", "password-123");
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/examples/todos"));
    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password-123",
    });
  });

  it("should show the mapped message and stay on the page when credentials are wrong", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce(failed("INVALID_EMAIL_OR_PASSWORD"));
    render(<SignInForm redirectTo="/" />);
    type("邮箱", "a@example.com");
    type("密码", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("邮箱或密码错误")).toBeTruthy();
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it("should not call the server when the email is invalid", async () => {
    render(<SignInForm redirectTo="/" />);
    type("邮箱", "not-an-email");
    type("密码", "password-123");
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("请输入有效的邮箱地址")).toBeTruthy();
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });
});

describe("SignUpForm", () => {
  it("should ask the user to check their inbox when sign-up succeeds", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValueOnce(ok);
    render(<SignUpForm />);
    type("昵称", "Alice");
    type("邮箱", "alice@example.com");
    type("密码", "password-123");
    type("确认密码", "password-123");
    fireEvent.click(screen.getByRole("button", { name: "注册" }));
    expect(await screen.findByText(/验证邮件已发送到 alice@example.com/)).toBeTruthy();
    expect(vi.mocked(authClient.signUp.email).mock.calls[0]?.[0]).toMatchObject({
      callbackURL: "/verify-email?status=verified",
    });
  });

  it("should reject mismatched passwords before calling the server", async () => {
    render(<SignUpForm />);
    type("昵称", "Alice");
    type("邮箱", "alice@example.com");
    type("密码", "password-123");
    type("确认密码", "password-456");
    fireEvent.click(screen.getByRole("button", { name: "注册" }));
    expect(await screen.findByText("两次输入的密码不一致")).toBeTruthy();
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  });
});

describe("ForgotPasswordForm", () => {
  it("should show the same confirmation whether or not the account exists", async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValueOnce(ok);
    render(<ForgotPasswordForm />);
    type("邮箱", "maybe@example.com");
    fireEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));
    expect(await screen.findByText(/如果该邮箱已注册/)).toBeTruthy();
    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: "maybe@example.com",
      redirectTo: "/reset-password",
    });
  });
});

describe("ResetPasswordForm", () => {
  it("should send the token with the new password and confirm the reset", async () => {
    vi.mocked(authClient.resetPassword).mockResolvedValueOnce(ok);
    render(<ResetPasswordForm token="token-1" />);
    type("新密码", "new-password-1");
    type("确认新密码", "new-password-1");
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));
    expect(await screen.findByText(/密码已重置/)).toBeTruthy();
    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password-1",
      token: "token-1",
    });
  });

  it("should explain an expired link", async () => {
    vi.mocked(authClient.resetPassword).mockResolvedValueOnce(failed("INVALID_TOKEN"));
    render(<ResetPasswordForm token="stale" />);
    type("新密码", "new-password-1");
    type("确认新密码", "new-password-1");
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));
    expect(await screen.findByText("链接无效或已过期，请重新申请")).toBeTruthy();
  });
});
