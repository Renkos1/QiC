import { cn } from "@qic/ui/lib/utils";
import type * as React from "react";

/**
 * Bordered surface grouping related content (journal-style card).
 *
 * 带边框的内容容器（工程日志风格卡片）。
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-md border bg-card py-6 text-card-foreground shadow-journal",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Header area of a {@link Card}: title, description and optional action.
 *
 * {@link Card} 的头部：标题、描述和可选操作。
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Title of a {@link Card}.
 *
 * {@link Card} 的标题。
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

/**
 * Muted description under a {@link CardTitle}.
 *
 * {@link CardTitle} 下方的弱化描述。
 */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Action slot aligned to the right of a {@link CardHeader}.
 *
 * {@link CardHeader} 右侧的操作位。
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

/**
 * Main content of a {@link Card}.
 *
 * {@link Card} 的主体内容。
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

/**
 * Footer row of a {@link Card}, usually buttons.
 *
 * {@link Card} 的底部，通常放按钮。
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
