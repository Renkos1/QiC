"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@qic/ui/components/button";
import { Checkbox } from "@qic/ui/components/checkbox";
import { Label } from "@qic/ui/components/label";
import { Textarea } from "@qic/ui/components/textarea";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { apiErrorMessage } from "@/lib/api";
import { SuggestionTextSchema, type SuggestionTextValues } from "./todo-schemas";
import { useCapabilities, useCreateTodo, useSuggestTodos } from "./use-todos";

/**
 * Splits a free-text note into todo suggestions; the user picks which to add.
 * Shows a notice instead of results when the deployment has no AI configured.
 *
 * 把一段文字交给 AI 拆分为待办建议，由用户挑选添加；部署未配置 AI 时显示提示。
 */
export const SuggestPanel = () => {
  const capabilities = useCapabilities();
  const suggest = useSuggestTodos();
  const createTodo = useCreateTodo();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuggestionTextValues>({ resolver: zodResolver(SuggestionTextSchema) });

  const aiEnabled = capabilities.data?.ai === true;
  const titles = suggest.data?.titles ?? [];

  const onSubmit = handleSubmit(async ({ text }) => {
    const result = await suggest.mutateAsync(text).catch(() => undefined);
    setSelected(new Set(result?.titles ?? []));
  });

  const addSelected = async () => {
    setAdding(true);
    // Sequential so the list order matches the suggestion order.
    for (const title of titles.filter((t) => selected.has(t))) {
      await createTodo.mutateAsync(title).catch(() => undefined);
    }
    setAdding(false);
    suggest.reset();
    reset();
  };

  const toggle = (title: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(title);
      else next.delete(title);
      return next;
    });

  return (
    <section aria-labelledby="suggest-heading" className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="suggest-heading" className="flex items-center gap-2 text-lg">
          <Sparkles aria-hidden className="size-4 text-sand" />
          一句话拆分待办
        </h2>
        <span className="journal-kicker">AI / CLAUDE</span>
      </div>

      {!capabilities.isPending && !aiEnabled && (
        <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-sm">
          AI 功能未启用：服务器未配置 ANTHROPIC_API_KEY。
        </p>
      )}

      <form onSubmit={onSubmit} className="grid gap-2" noValidate>
        <Textarea
          aria-label="要拆分的描述"
          placeholder="例如：周末打扫房间，顺便把旧衣服捐掉，再约朋友吃饭"
          disabled={!aiEnabled}
          aria-invalid={errors.text ? true : undefined}
          {...register("text")}
        />
        {errors.text?.message && <p className="text-destructive text-sm">{errors.text.message}</p>}
        <Button
          type="submit"
          variant="outline"
          disabled={!aiEnabled || suggest.isPending}
          className="justify-self-start"
        >
          {suggest.isPending ? "正在生成…" : "生成建议"}
        </Button>
        <FormAlert message={suggest.error ? apiErrorMessage(suggest.error) : null} />
      </form>

      {titles.length > 0 && (
        <div className="grid gap-2 rounded-md border bg-white/30 p-3">
          <ul className="grid gap-2" aria-label="建议的待办">
            {titles.map((title, index) => {
              const id = `suggestion-${index}`;
              return (
                <li key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={selected.has(title)}
                    onCheckedChange={(checked) => toggle(title, checked === true)}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {title}
                  </Label>
                </li>
              );
            })}
          </ul>
          <Button
            onClick={addSelected}
            disabled={selected.size === 0 || adding}
            className="justify-self-start"
          >
            {adding ? "正在添加…" : `添加所选（${selected.size}）`}
          </Button>
        </div>
      )}
    </section>
  );
};
