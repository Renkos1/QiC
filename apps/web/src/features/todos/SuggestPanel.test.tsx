// @vitest-environment jsdom
/*
 * AI suggestion panel with real hooks; only the `api` client is faked.
 *
 * AI 拆分面板：hooks 为真实实现，只替换 `api` 客户端。
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { aTodo, fetchResult, renderWithQuery } from "@/test/render";
import { SuggestPanel } from "./SuggestPanel";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const get = vi.mocked(api.GET);
const post = vi.mocked(api.POST);

const pathOf = (call: unknown[]) => call[0] as string;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("SuggestPanel", () => {
  it("should explain and disable the input when AI is not configured", async () => {
    get.mockResolvedValueOnce(fetchResult(200, { ai: false }) as never);
    renderWithQuery(<SuggestPanel />);
    expect(await screen.findByText(/AI 功能未启用/)).toBeTruthy();
    expect((screen.getByLabelText("要拆分的描述") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("should add only the selected suggestions, in order", async () => {
    get.mockResolvedValueOnce(fetchResult(200, { ai: true }) as never);
    post.mockImplementation(
      async (path) =>
        (path === "/todos/suggestions"
          ? fetchResult(200, { titles: ["打扫房间", "捐旧衣服", "约朋友吃饭"] })
          : fetchResult(201, aTodo())) as never,
    );
    renderWithQuery(<SuggestPanel />);
    const input = screen.getByLabelText("要拆分的描述") as HTMLTextAreaElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: "周末打扫房间，捐旧衣服，约朋友吃饭" } });
    fireEvent.click(screen.getByRole("button", { name: "生成建议" }));

    // Every suggestion starts selected; untick the middle one.
    fireEvent.click(await screen.findByRole("checkbox", { name: "捐旧衣服" }));
    fireEvent.click(screen.getByRole("button", { name: "添加所选（2）" }));

    await waitFor(() =>
      expect(post.mock.calls.filter((call) => pathOf(call) === "/todos")).toHaveLength(2),
    );
    const added = post.mock.calls
      .filter((call) => pathOf(call) === "/todos")
      .map((call) => (call[1] as unknown as { body: { title: string } }).body.title);
    expect(added).toEqual(["打扫房间", "约朋友吃饭"]);
  });

  it("should show a friendly message when the AI call fails", async () => {
    get.mockResolvedValueOnce(fetchResult(200, { ai: true }) as never);
    post.mockResolvedValueOnce(fetchResult(503) as never);
    renderWithQuery(<SuggestPanel />);
    const input = screen.getByLabelText("要拆分的描述") as HTMLTextAreaElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: "随便写点" } });
    fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
    expect(await screen.findByText("服务暂时不可用，请稍后重试")).toBeTruthy();
  });
});
