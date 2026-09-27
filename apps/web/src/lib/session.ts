import { headers } from "next/headers";
import { z } from "zod";
import { getServerEnv } from "@/env";

const SessionSchema = z
  .object({
    user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
    session: z.object({ id: z.string(), expiresAt: z.coerce.date() }),
  })
  .nullable();

/** The signed-in user and session, as seen by server components. 服务端组件看到的当前用户与会话。 */
export type ServerSession = NonNullable<z.infer<typeof SessionSchema>>;

/**
 * Resolves the current session on the server by forwarding the request cookies to
 * apps/api. The proxy only checks that a cookie exists; this is the real check.
 *
 * 在服务端解析当前会话：把请求的 Cookie 转发给 apps/api 校验。
 * proxy 只检查 Cookie 是否存在，这里才是真正的校验。同时转发客户端 IP（`X-Forwarded-For`），
 * 否则所有用户会在 api 端共用一个限流计数。没有 Cookie 或 api 拒绝时返回 null；api 不可达时抛出（由 Next 错误页处理）。
 */
export const getServerSession = async (): Promise<ServerSession | null> => {
  const incoming = await headers();
  const cookie = incoming.get("cookie");
  if (!cookie) return null;
  // Pass on the client IP Caddy recorded; without it every user would share one
  // rate-limit bucket on the api, because this call comes from the web container.
  const forwardedFor = incoming.get("x-forwarded-for");
  const response = await fetch(`${getServerEnv().API_ORIGIN}/api/auth/get-session`, {
    headers: { cookie, ...(forwardedFor && { "x-forwarded-for": forwardedFor }) },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return SessionSchema.parse(await response.json());
};
