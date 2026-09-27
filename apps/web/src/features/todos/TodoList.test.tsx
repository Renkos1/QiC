// @vitest-environment jsdom
/*
 * The todo list: empty, error and paging states, and optimistic rollback. Real hooks;
 * only the `api` client is faked.
 *
 * 待办列表：空状态、错误重试、分页，以及乐观更新失败后的回滚。hooks 为真实实现，只替换 `api` 客户端。
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { aTodo, fetchResult, renderWithQuery } from "@/test/render";
import { TodoList } from "./TodoList";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const get = vi.mocked(api.GET);
const patch = vi.mocked(api.PATCH);

const page = (items: unknown[], nextCursor: string | null = null) =>
  fetchResult(200, { items, nextCursor }) as never;

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

describe("TodoList", () => {
  it("should show the empty state when the user has no todos", async () => {
    get.mockResolvedValueOnce(page([]));
    renderWithQuery(<TodoList />);
    expect(await screen.findByText(/还没有待办/)).toBeTruthy();
  });

  it("should offer a retry when loading fails", async () => {
    get.mockResolvedValueOnce(fetchResult(503) as never).mockResolvedValueOnce(page([aTodo()]));
    renderWithQuery(<TodoList />);
    expect(await screen.findByText("加载失败：服务暂时不可用，请稍后重试")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("买牛奶")).toBeTruthy();
  });

  it("should load the next page with the cursor from the previous one", async () => {
    get
      .mockResolvedValueOnce(page([aTodo({ id: "1", title: "第一页" })], "cursor-1"))
      .mockResolvedValueOnce(page([aTodo({ id: "2", title: "第二页" })]));
    renderWithQuery(<TodoList />);
    fireEvent.click(await screen.findByRole("button", { name: "加载更多" }));
    expect(await screen.findByText("第二页")).toBeTruthy();
    const [, init] = get.mock.calls[1] as unknown as [string, { params: { query: unknown } }];
    const query = init.params.query;
    expect(query).toEqual({ limit: 20, cursor: "cursor-1" });
    expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull();
  });

  it("should roll back an optimistic update when the api rejects it", async () => {
    get.mockResolvedValue(page([aTodo()]));
    let rejectPatch: (value: unknown) => void = () => {};
    patch.mockReturnValueOnce(
      new Promise((resolve) => {
        rejectPatch = resolve;
      }) as never,
    );
    renderWithQuery(<TodoList />);
    const checkbox = await screen.findByRole("checkbox", { name: "完成「买牛奶」" });
    fireEvent.click(checkbox);
    // Optimistic: the list shows the todo as completed before the server answers.
    expect(await screen.findByRole("checkbox", { name: "标记「买牛奶」为未完成" })).toBeTruthy();
    rejectPatch(fetchResult(500));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "完成「买牛奶」" })).toBeTruthy(),
    );
  });
});
