"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and until hydration, true afterwards. Disable submit
 * buttons with it: before hydration a click submits the form natively as a GET, which
 * would put its fields (including passwords) into the URL and server logs.
 *
 * 服务端渲染和水合完成之前为 false，之后为 true。用它禁用提交按钮：水合前点击会以原生 GET 提交表单，
 * 把字段（包括密码）放进 URL 和服务器日志。
 *
 * @example <Button type="submit" disabled={!hydrated || isSubmitting}>
 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
