import type { Todo } from "@qic/contracts";
import type { TodoRow } from "@qic/db";
import { z } from "zod";

/**
 * Position after which the next page starts; ordering is (createdAt desc, id desc).
 *
 * 下一页的起始位置；排序为 (createdAt 降序, id 降序)，id 用于区分同一毫秒创建的待办。
 */
export interface TodoCursor {
  createdAt: Date;
  id: string;
}

const CursorPayloadSchema = z.object({ c: z.iso.datetime(), i: z.uuid() });

/**
 * Encodes an opaque, URL-safe cursor. Clients must not parse it.
 *
 * 编码为不透明、URL 安全的游标（base64url JSON）。客户端不得解析它。
 */
export const encodeCursor = ({ createdAt, id }: TodoCursor): string =>
  Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString("base64url");

/**
 * Returns null for anything that is not a cursor this API issued.
 *
 * 解码游标；不是本 API 签发的游标一律返回 null（调用方据此返回 400）。
 */
export const decodeCursor = (cursor: string): TodoCursor | null => {
  try {
    const json: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const parsed = CursorPayloadSchema.safeParse(json);
    return parsed.success ? { createdAt: new Date(parsed.data.c), id: parsed.data.i } : null;
  } catch {
    return null;
  }
};

/**
 * Maps a database row to the contract shape (ISO timestamps, no `userId`).
 *
 * 把数据库行转换为契约格式（ISO 时间戳，不含 `userId`）。
 */
export const toTodoDto = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  completed: row.completed,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
