/*
 * The Next proxy (auth gate) with real NextRequest objects.
 *
 * Next proxy（鉴权拦截）测试，使用真实的 NextRequest。
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const request = (url: string, cookie?: string) =>
  new NextRequest(url, { headers: cookie ? { cookie } : {} });

describe("proxy", () => {
  it("should let the request through when a session cookie is present", () => {
    const response = proxy(
      request("http://localhost:13000/examples/todos", "better-auth.session_token=abc"),
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("should redirect to sign-in and remember the page when there is no session cookie", () => {
    const response = proxy(request("http://localhost:13000/examples/todos?page=2"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/examples/todos?page=2");
  });
});
