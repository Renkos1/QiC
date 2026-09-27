"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@qic/ui/components/button";
import { Input } from "@qic/ui/components/input";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { apiErrorMessage } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";
import { TodoTitleSchema, type TodoTitleValues } from "./todo-schemas";
import { useCreateTodo } from "./use-todos";

/**
 * Adds a todo; each submission carries its own idempotency key (see useCreateTodo).
 *
 * 添加待办；每次提交带独立的幂等键（见 useCreateTodo），网络重试不会重复创建。
 */
export const AddTodoForm = () => {
  const hydrated = useHydrated();
  const createTodo = useCreateTodo();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TodoTitleValues>({ resolver: zodResolver(TodoTitleSchema) });

  const onSubmit = handleSubmit(async ({ title }) => {
    await createTodo.mutateAsync(title).then(
      () => reset(),
      () => undefined, // Error is rendered from createTodo.error below.
    );
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-2" noValidate>
      <div className="flex gap-2">
        <Input
          aria-label="新待办"
          placeholder="写下一件要做的事，回车添加"
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          {...register("title")}
        />
        <Button type="submit" disabled={!hydrated || createTodo.isPending}>
          <Plus aria-hidden />
          添加
        </Button>
      </div>
      {errors.title?.message && <p className="text-destructive text-sm">{errors.title.message}</p>}
      <FormAlert message={createTodo.error ? apiErrorMessage(createTodo.error) : null} />
    </form>
  );
};
