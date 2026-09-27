import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves conflicting Tailwind utilities (last one wins).
 *
 * 合并 className，并解决冲突的 Tailwind 工具类（后者覆盖前者）。
 *
 * @example cn("px-2", isActive && "bg-primary", className)
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
