import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "工作区" };

/**
 * Placeholder home until the product is defined; lists the modules that exist today.
 *
 * 产品定义确定前的占位首页，列出当前已有的模块（目前只有示例待办）。
 */
export default function HomePage() {
  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <span className="journal-kicker">QIC / WORKSPACE / 2026</span>
        <h1 className="text-4xl leading-none sm:text-5xl">QiC</h1>
        <p className="max-w-prose text-muted-foreground">
          产品功能正在定义中。目前可以查看工程骨架自带的示例模块。
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/examples/todos"
            className="group grid min-h-40 content-between gap-6 rounded-md border bg-card p-5 shadow-journal transition-colors hover:bg-white/50"
          >
            <span className="journal-kicker">EXAMPLE / 01</span>
            <span className="grid gap-1">
              <span className="flex items-center justify-between text-xl">
                示例：待办
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform group-hover:translate-x-1"
                />
              </span>
              <span className="text-muted-foreground text-sm">
                端到端参考模块：分页、幂等创建、邮件通知、AI 拆分
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
