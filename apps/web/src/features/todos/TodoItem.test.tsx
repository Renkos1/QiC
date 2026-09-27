// @vitest-environment jsdom
/*
 * A todo row: toggle, rename, delete. Real hooks; only the `api` client is faked.
 *
 * 单条待办：完成、改名、删除。hooks 为真实实现，只替换 `api` 客户端。
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { aTodo, fetchResult, renderWithQuery } from "@/test/render";
import { TodoItem } from "./TodoItem";
import type { Todo } from "./use-todos";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const patch = vi.mocked(api.PATCH);
const remove = vi.mocked(api.DELETE);
const todo = aTodo() as Todo;

beforeEach(() => {
  patch.mockReset().mockResolvedValue(fetchResult(200, todo) as never);
  remove.mockReset().mockResolvedValue(fetchResult(204) as never);
});

const patchBody = () => (patch.mock.calls[0] as unknown as [string, { body: unknown }])[1].body;

describe("TodoItem", () => {
  it("should mark the todo completed when its checkbox is clicked", async () => {
    renderWithQuery(<TodoItem todo={todo} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "完成「买牛奶」" }));
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patchBody()).toEqual({ completed: true });
  });

  it("should delete the todo when the delete button is clicked", async () => {
    renderWithQuery(<TodoItem todo={todo} />);
    fireEvent.click(screen.getByRole("button", { name: "删除「买牛奶」" }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });

  it("should save a changed title when the edit form is submitted", async () => {
    renderWithQuery(<TodoItem todo={todo} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑「买牛奶」" }));
    fireEvent.change(screen.getByLabelText("编辑待办"), { target: { value: " 买燕麦奶 " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patchBody()).toEqual({ title: "买燕麦奶" });
  });

  it("should not call the api when the title is unchanged or blank", async () => {
    renderWithQuery(<TodoItem todo={todo} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑「买牛奶」" }));
    fireEvent.change(screen.getByLabelText("编辑待办"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("买牛奶")).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
  });

  it("should discard the draft when editing is cancelled with Escape", () => {
    renderWithQuery(<TodoItem todo={todo} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑「买牛奶」" }));
    const input = screen.getByLabelText("编辑待办");
    fireEvent.change(input, { target: { value: "draft" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByLabelText("编辑待办")).toBeNull();
    expect(screen.getByText("买牛奶")).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
  });
});
