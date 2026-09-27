import type { FieldError, Problem } from "@qic/contracts";

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

/**
 * Throw from any layer to return an RFC 9457 response with this status.
 *
 * 在任意层抛出，都会被 {@link ProblemFilter} 转成对应状态码的 RFC 9457 响应。
 * `detail` 会返回给用户，不能包含内部信息。
 *
 * @example throw new ProblemError(404, { detail: "Todo not found" })
 */
export class ProblemError extends Error {
  readonly status: number;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;

  constructor(status: number, options: { detail?: string; errors?: FieldError[] } = {}) {
    super(options.detail ?? STATUS_TITLES[status] ?? "Error");
    this.name = "ProblemError";
    this.status = status;
    this.detail = options.detail;
    this.errors = options.errors;
  }
}

/**
 * Builds an RFC 9457 body with the standard title for `status`.
 *
 * 按状态码生成带标准标题的 RFC 9457 响应体。
 *
 * @param status - HTTP status. HTTP 状态码。
 * @param extra - Optional detail, instance, traceId and field errors. 可选的详情、实例路径、traceId 和字段错误。
 */
export const problemBody = (
  status: number,
  extra: Omit<Partial<Problem>, "status"> = {},
): Problem => ({
  type: "about:blank",
  title: STATUS_TITLES[status] ?? "Error",
  status,
  ...extra,
});

/**
 * Validation issues in Standard Schema form (what zod and Nest's schema pipe produce).
 *
 * Standard Schema 格式的校验问题（zod 与 Nest 的 schema 管道都产出这种格式）。
 */
export interface SchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

/**
 * Turns schema validation issues into a 400 problem with per-field errors.
 *
 * 把 schema 校验问题转换为带逐字段错误的 400 ProblemError。
 *
 * @param issues - Issues from zod or the Standard Schema pipe. 来自 zod 或 Standard Schema 管道的问题列表。
 */
export const validationProblem = (issues: readonly SchemaIssue[]) =>
  new ProblemError(400, {
    detail: "Request validation failed",
    errors: issues.map((issue) => ({
      path: (issue.path ?? [])
        .map((segment) => String(typeof segment === "object" ? segment.key : segment))
        .join("."),
      message: issue.message,
    })),
  });
