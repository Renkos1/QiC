/**
 * Returns `target` only if it is a same-site relative path; otherwise `fallback`.
 * Prevents open redirects through `?next=https://evil.example`.
 *
 * 只有 `target` 是站内相对路径时才返回它，否则返回 `fallback`，防止通过 `?next=` 实施开放重定向。
 *
 * @param target - Untrusted value, e.g. from `?next=`. 不可信的值。
 * @param fallback - Used when `target` is rejected. 被拒绝时的默认路径。
 */
export const safeRedirectPath = (target: unknown, fallback = "/"): string => {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return target;
};
