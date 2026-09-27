/**
 * Full page load to `url`. Use after the auth state changes (e.g. sign-in): a client-side
 * `router.replace` can reuse a page prefetched while signed out, whose cached result is
 * "redirect to sign-in" (production builds prefetch links; `next dev` does not).
 *
 * 整页跳转到 `url`。在登录态变化后使用（例如登录成功）：客户端 `router.replace` 可能复用
 * 未登录时预取的页面，而其缓存结果是“跳转到登录页”（生产构建会预取链接，`next dev` 不会）。
 *
 * @param url - Same-site path. 站内路径。
 */
export const hardNavigate = (url: string) => {
  window.location.assign(url);
};
