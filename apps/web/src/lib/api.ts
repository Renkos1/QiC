import { createApiClient, type Schemas } from "@qic/api-client";

/**
 * Browser client; relative /api is proxied to apps/api on the same origin.
 *
 * 浏览器端 API 客户端；相对路径 `/api` 经同源代理转发到 apps/api。
 */
export const api = createApiClient();

type Problem = Schemas["Problem"];

/**
 * A non-2xx API response, carrying the RFC 9457 problem body when there is one.
 *
 * 非 2xx 的 API 响应；有 RFC 9457 错误体时一并携带。
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem | undefined,
  ) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
    this.name = "ApiError";
  }
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Returns the data of a successful openapi-fetch call, or throws ApiError.
 *
 * 返回 openapi-fetch 调用成功时的数据，否则抛出 ApiError。
 *
 * @throws {ApiError} On any non-2xx response. 任何非 2xx 响应。
 */
export const unwrap = async <T>(call: Promise<FetchResult<T>>): Promise<T> => {
  const { data, error, response } = await call;
  if (!response.ok) throw new ApiError(response.status, error as Problem | undefined);
  // 204 responses have no body; callers of such endpoints expect undefined.
  return data as T;
};

/**
 * User-facing message for an API failure; never shows raw server internals.
 *
 * 把 API 失败转换为给用户看的文案；不展示服务端原始信息。
 */
export const apiErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) return "网络异常，请检查连接后重试";
  if (error.status === 401) return "登录已过期，请重新登录";
  if (error.status === 404) return "该待办已不存在";
  if (error.status === 429) return "操作太频繁，请稍后再试";
  if (error.status === 503) return "服务暂时不可用，请稍后重试";
  if (error.status >= 500) return "服务出错了，请稍后重试";
  return "请求无效，请检查输入";
};
