/*
 * The browser API helpers: unwrapping openapi-fetch results and user-facing error copy.
 *
 * 浏览器端 API 工具：解包 openapi-fetch 结果，以及面向用户的错误文案。
 */
import { describe, expect, it } from "vitest";
import { fetchResult } from "@/test/render";
import { ApiError, apiErrorMessage, unwrap } from "./api";

describe("unwrap", () => {
  it("should return the data when the response is successful", async () => {
    await expect(unwrap(Promise.resolve(fetchResult(200, { ok: 1 })))).resolves.toEqual({ ok: 1 });
  });

  it("should resolve undefined when the response has no body", async () => {
    await expect(unwrap(Promise.resolve(fetchResult(204)))).resolves.toBeUndefined();
  });

  it("should throw ApiError with the problem detail when the response fails", async () => {
    const problem = { type: "about:blank", title: "Not Found", status: 404, detail: "gone" };
    const error = await unwrap(Promise.resolve(fetchResult(404, problem))).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, problem, message: "gone" });
  });

  it("should fall back to the status when the failure has no problem body", async () => {
    const error = await unwrap(Promise.resolve(fetchResult(502))).catch((e: unknown) => e);
    expect(error).toMatchObject({ message: "HTTP 502" });
  });
});

describe("apiErrorMessage", () => {
  it.each([
    [401, "登录已过期，请重新登录"],
    [404, "该待办已不存在"],
    [429, "操作太频繁，请稍后再试"],
    [503, "服务暂时不可用，请稍后重试"],
    [500, "服务出错了，请稍后重试"],
    [400, "请求无效，请检查输入"],
  ])("should map status %i to user-facing copy", (status, message) => {
    expect(apiErrorMessage(new ApiError(status, undefined))).toBe(message);
  });

  it("should report a network problem when the error is not an ApiError", () => {
    expect(apiErrorMessage(new TypeError("Failed to fetch"))).toBe("网络异常，请检查连接后重试");
  });

  it("should never show the server's own detail text", () => {
    const leaked = new ApiError(500, {
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail: "stack trace",
    });
    expect(apiErrorMessage(leaked)).not.toContain("stack trace");
  });
});
