/**
 * Rendered per request (never cached), so the check reflects the live process.
 *
 * 每次请求实时执行（不缓存），保证健康检查反映进程的真实状态。
 */
export const dynamic = "force-dynamic";

/**
 * `GET /healthz`: liveness for the container health check; must not depend on the api or a session.
 *
 * `GET /healthz`：容器健康检查用的存活接口；不能依赖 api 或会话。Caddy 不对外转发它。
 */
export const GET = () => Response.json({ status: "ok" });
