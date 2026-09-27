/*
 * Todo request schemas and pagination query parsing.
 *
 * 待办请求 schema 与分页查询参数解析。
 */
import { describe, expect, it } from "vitest";
import { CursorQuerySchema, DEFAULT_PAGE_LIMIT } from "../common/pagination.js";
import { CreateTodoSchema, TODO_TITLE_MAX, UpdateTodoSchema } from "./schema.js";

describe("CreateTodoSchema", () => {
  it("should trim the title when it has surrounding whitespace", () => {
    expect(CreateTodoSchema.parse({ title: "  Buy milk  " })).toEqual({ title: "Buy milk" });
  });

  it("should reject the title when it is blank after trimming", () => {
    expect(CreateTodoSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("should reject the title when it exceeds the maximum length", () => {
    const title = "x".repeat(TODO_TITLE_MAX + 1);
    expect(CreateTodoSchema.safeParse({ title }).success).toBe(false);
  });
});

describe("UpdateTodoSchema", () => {
  it("should reject the body when no field is provided", () => {
    expect(UpdateTodoSchema.safeParse({}).success).toBe(false);
  });

  it("should accept the body when only completed is provided", () => {
    expect(UpdateTodoSchema.parse({ completed: true })).toEqual({ completed: true });
  });
});

describe("CursorQuerySchema", () => {
  it("should apply the default limit when limit is missing", () => {
    expect(CursorQuerySchema.parse({})).toEqual({ limit: DEFAULT_PAGE_LIMIT });
  });

  it("should coerce the limit when it arrives as a query string", () => {
    expect(CursorQuerySchema.parse({ limit: "5" }).limit).toBe(5);
  });

  it("should reject the limit when it is above the maximum", () => {
    expect(CursorQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
  });
});
