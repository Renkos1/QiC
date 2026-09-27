import { cn } from "@qic/ui/lib/utils";

/**
 * Loading placeholder with a pulse animation.
 *
 * 加载中的占位块，带闪烁动画。
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

export { Skeleton };
