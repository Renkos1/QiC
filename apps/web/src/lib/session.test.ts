/*
 * Server-side session lookup with `next/headers` and `fetch` faked.
 *
 * 服务端会话解析：替换 `next/headers` 与 `fetch`。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

const { getServerSession } = await import("./session");

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  requestHeaders.delete("cookie");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getServerSession", () => {
  it("should return null without calling the api when there is no cookie", async () => {
    expect(await getServerSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should forward the cookie to the api and parse the session", async () => {
    requestHeaders.set("cookie", "better-auth.session_token=abc");
    fetchMock.mockResolvedValueOnce(
      Response.json({
        user: { id: "u1", name: "A", email: "a@example.com" },
        session: { id: "s1", expiresAt: "2026-10-01T00:00:00.000Z" },
      }),
    );
    const session = await getServerSession();
    expect(session?.user.id).toBe("u1");
    expect(session?.session.expiresAt).toBeInstanceOf(Date);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/api\/auth\/get-session$/);
    expect(new Headers(init?.headers).get("cookie")).toBe("better-auth.session_token=abc");
  });

  it("should forward the client IP so the api rate-limits per user, not per web container", async () => {
    requestHeaders.set("cookie", "better-auth.session_token=abc");
    requestHeaders.set("x-forwarded-for", "203.0.113.7");
    fetchMock.mockResolvedValueOnce(Response.json(null));
    await getServerSession();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("x-forwarded-for")).toBe("203.0.113.7");
    requestHeaders.delete("x-forwarded-for");
  });

  it("should return null when the api rejects the session", async () => {
    requestHeaders.set("cookie", "better-auth.session_token=expired");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await getServerSession()).toBeNull();
  });

  it("should return null when the api reports no session", async () => {
    requestHeaders.set("cookie", "better-auth.session_token=unknown");
    fetchMock.mockResolvedValueOnce(Response.json(null));
    expect(await getServerSession()).toBeNull();
  });
});
