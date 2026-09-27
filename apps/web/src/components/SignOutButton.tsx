"use client";

import { Button } from "@qic/ui/components/button";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/navigation";

/**
 * Signs out and returns to the sign-in page.
 *
 * 退出登录并回到登录页。整页跳转会清空客户端缓存，已预取的私有页面不会在退出后被显示。
 */
export const SignOutButton = () => {
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await authClient.signOut();
    // A full load drops pages prefetched while signed in from the client cache.
    hardNavigate("/sign-in");
  };

  return (
    <Button variant="outline" onClick={signOut} disabled={pending}>
      {pending ? "正在退出…" : "退出登录"}
    </Button>
  );
};
