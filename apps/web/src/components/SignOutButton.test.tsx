// @vitest-environment jsdom
/*
 * SignOutButton with the Better Auth client and page navigation faked at the module boundary.
 *
 * 退出按钮测试：Better Auth 客户端与页面跳转在模块边界替换为假实现。
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import "@/test/render";
import { SignOutButton } from "./SignOutButton";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn(async () => ({})) } }));
const hardNavigate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation", () => ({ hardNavigate }));

describe("SignOutButton", () => {
  it("should end the session and return to the sign-in page", async () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/sign-in"));
    expect(authClient.signOut).toHaveBeenCalledOnce();
  });
});
