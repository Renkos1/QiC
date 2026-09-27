import { z } from "zod";

/** Mirrors `TODO_TITLE_MAX` in contracts; the api re-validates. 与契约中的 `TODO_TITLE_MAX` 一致，api 会再次校验。 */
export const TITLE_MAX = 200;
/** Mirrors `SUGGESTION_TEXT_MAX` in contracts. 与契约中的 `SUGGESTION_TEXT_MAX` 一致。 */
export const SUGGESTION_MAX = 1_000;

/** Form schema of the add-todo input (Chinese messages). 添加待办表单的校验（中文提示）。 */
export const TodoTitleSchema = z.object({
  title: z.string().trim().min(1, "请输入待办内容").max(TITLE_MAX, `最多 ${TITLE_MAX} 个字符`),
});

/** Form schema of the AI suggestion input. AI 拆分输入框的校验。 */
export const SuggestionTextSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "请输入一段描述")
    .max(SUGGESTION_MAX, `最多 ${SUGGESTION_MAX} 个字符`),
});

/** Add-todo form values. 添加待办表单值。 */
export type TodoTitleValues = z.infer<typeof TodoTitleSchema>;
/** Suggestion form values. AI 拆分表单值。 */
export type SuggestionTextValues = z.infer<typeof SuggestionTextSchema>;
