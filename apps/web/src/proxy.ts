import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic auth gate: redirects to sign-in when no session cookie is present.
 * It does not validate the session; protected pages still call getServerSession().
 *
 * 乐观的鉴权拦截（Next 16 的 proxy，替代 middleware）：没有会话 Cookie 时跳转登录页。
 * 它不校验会话是否有效，受保护的页面仍需调用 `getServerSession()`。
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

/** Paths the proxy runs on. proxy 生效的路径。 */
export const config = {
  // Everything except the API proxy, the OTLP relay, static assets and the public auth pages.
  matcher: [
    "/((?!api/|otlp/|healthz|_next/static|_next/image|favicon.ico|sign-in|sign-up|verify-email|forgot-password|reset-password).*)",
  ],
};
