"use client";

import { cn } from "@qic/ui/lib/utils";
import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * Form label (Radix); pair with an input through `htmlFor`.
 *
 * 表单标签（基于 Radix）；通过 `htmlFor` 关联输入框。
 */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
