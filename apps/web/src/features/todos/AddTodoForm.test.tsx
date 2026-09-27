// @vitest-environment jsdom
/*
 * AddTodoForm with real hooks and React Query; only the `api` client (network) is faked.
 *
 * 添加待办表单：hooks 与 React Query 为真实实现，只替换 `api` 客户端（网络边界）。
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { aTodo, fetchResult, renderWithQuery } from "@/test/render";
import { AddTodoForm } from "./AddTodoForm";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const post = vi.mocked(api.POST);

beforeEach(() => {
  post.mockReset();
});

const submit = (title: string) => {
  fireEvent.change(screen.getByLabelText("新待办"), { target: { value: title } });
  fireEvent.click(screen.getByRole("button", { name: "添加" }));
};

describe("AddTodoForm", () => {
  it("should show a validation message and not call the api when the title is blank", async () => {
    renderWithQuery(<AddTodoForm />);
    submit("   ");
    expect(await screen.findByText("请输入待办内容")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("should post the trimmed title with an idempotency key and clear the input", async () => {
    post.mockResolvedValueOnce(fetchResult(201, aTodo()) as never);
    renderWithQuery(<AddTodoForm />);
    submit("  买牛奶  ");
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    const [path, init] = post.mock.calls[0] as unknown as [
      string,
      { body: unknown; params: { header: Record<string, string> } },
    ];
    expect(path).toBe("/todos");
    expect(init.body).toEqual({ title: "买牛奶" });
    expect(init.params.header["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() =>
      expect((screen.getByLabelText("新待办") as HTMLInputElement).value).toBe(""),
    );
  });

  it("should use a new idempotency key for every submission", async () => {
    post.mockResolvedValue(fetchResult(201, aTodo()) as never);
    renderWithQuery(<AddTodoForm />);
    submit("a");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    submit("b");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const keys = post.mock.calls.map(
      (call) =>
        (call[1] as unknown as { params: { header: Record<string, string> } }).params.header[
          "idempotency-key"
        ],
    );
    expect(new Set(keys).size).toBe(2);
  });

  it("should keep the text and show a message when the api fails", async () => {
    post.mockResolvedValueOnce(fetchResult(500) as never);
    renderWithQuery(<AddTodoForm />);
    submit("买牛奶");
    expect(await screen.findByText("服务出错了，请稍后重试")).toBeTruthy();
    expect((screen.getByLabelText("新待办") as HTMLInputElement).value).toBe("买牛奶");
  });
});
