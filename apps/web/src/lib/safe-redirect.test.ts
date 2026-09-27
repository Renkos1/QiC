/*
 * Open-redirect protection for `?next=`.
 *
 * `?next=` 的开放重定向防护。
 */
import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect.js";

describe("safeRedirectPath", () => {
  it("should keep the path when it is a relative same-site path", () => {
    expect(safeRedirectPath("/todos?x=1")).toBe("/todos?x=1");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "should fall back when the target is %s",
    (target) => {
      expect(safeRedirectPath(target)).toBe("/");
    },
  );

  it("should fall back when the target is missing", () => {
    expect(safeRedirectPath(undefined, "/home")).toBe("/home");
  });
});
