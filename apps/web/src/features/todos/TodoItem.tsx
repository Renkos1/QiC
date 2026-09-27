"use client";

import { Button } from "@qic/ui/components/button";
import { Checkbox } from "@qic/ui/components/checkbox";
import { Input } from "@qic/ui/components/input";
import { cn } from "@qic/ui/lib/utils";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { TITLE_MAX } from "./todo-schemas";
import { type Todo, useDeleteTodo, useUpdateTodo } from "./use-todos";

/**
 * One todo row: toggle completion, delete.
 *
 * 单条待办：切换完成状态、删除。
 *
 * @param props.todo - The todo to show. 要显示的待办。
 */
export const TodoItem = ({ todo }: { todo: Todo }) => {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const checkboxId = `todo-${todo.id}`;

  const saveTitle = (event: FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (title && title !== todo.title) updateTodo.mutate({ id: todo.id, patch: { title } });
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(todo.title);
    setEditing(false);
  };

  return (
    <li className="group flex min-h-14 items-center gap-3 border-b px-4 last:border-b-0">
      <Checkbox
        id={checkboxId}
        checked={todo.completed}
        onCheckedChange={(checked) =>
          updateTodo.mutate({ id: todo.id, patch: { completed: checked === true } })
        }
        aria-label={todo.completed ? `标记「${todo.title}」为未完成` : `完成「${todo.title}」`}
      />
      {editing ? (
        <form onSubmit={saveTitle} className="flex flex-1 items-center gap-1">
          <Input
            aria-label="编辑待办"
            value={draft}
            maxLength={TITLE_MAX}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelEdit();
            }}
            autoFocus
          />
          <Button type="submit" size="icon-sm" variant="ghost" aria-label="保存">
            <Check />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="取消"
            onClick={cancelEdit}
          >
            <X />
          </Button>
        </form>
      ) : (
        <>
          <label
            htmlFor={checkboxId}
            className={cn(
              "flex-1 cursor-pointer py-3 leading-snug",
              todo.completed && "text-muted-foreground line-through decoration-1",
            )}
          >
            {todo.title}
          </label>
          <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`编辑「${todo.title}」`}
              onClick={() => {
                setDraft(todo.title);
                setEditing(true);
              }}
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`删除「${todo.title}」`}
              onClick={() => deleteTodo.mutate(todo.id)}
            >
              <Trash2 />
            </Button>
          </div>
        </>
      )}
    </li>
  );
};
