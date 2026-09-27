/*
 * The example todos module end to end: sign-up, create, complete (notification email),
 * persistence and delete. Runs the real web, api and worker against docker compose.
 *
 * 示例待办模块的端到端流程：注册、创建、完成（通知邮件）、持久化与删除。
 * 在 docker compose 依赖上运行真实的 web、api 和 worker。
 */
import { expect, test } from "@playwright/test";
import { signUpAndVerify, waitForForm } from "../support/auth.js";
import { waitForEmail } from "../support/mailpit.js";

test.describe("example todos", () => {
  test("user signs up, verifies email and creates a todo @smoke", async ({ page }) => {
    await signUpAndVerify(page, "smoke");

    await page.goto("/examples/todos");
    await waitForForm(page, "添加");
    await expect(page.getByText("还没有待办")).toBeVisible();
    await page.getByLabel("新待办").fill("端到端测试：买牛奶");
    await page.getByRole("button", { name: "添加" }).click();

    const list = page.getByRole("list", { name: "待办列表" });
    await expect(list.getByText("端到端测试：买牛奶")).toBeVisible();
  });

  test("completing a todo sends a notification email", async ({ page }) => {
    const email = await signUpAndVerify(page, "notify");
    await page.goto("/examples/todos");
    await waitForForm(page, "添加");
    await page.getByLabel("新待办").fill("写周报");
    await page.getByRole("button", { name: "添加" }).click();

    await page.getByRole("checkbox", { name: "完成「写周报」" }).click();

    await expect(page.getByRole("checkbox", { name: "标记「写周报」为未完成" })).toBeChecked();
    await waitForEmail(email, "已完成：写周报");
  });

  test("todos persist after reload and can be deleted", async ({ page }) => {
    await signUpAndVerify(page, "persist");
    await page.goto("/examples/todos");
    await waitForForm(page, "添加");
    await page.getByLabel("新待办").fill("会被删除的待办");
    await page.getByRole("button", { name: "添加" }).click();
    const list = page.getByRole("list", { name: "待办列表" });
    await expect(list.getByText("会被删除的待办")).toBeVisible();

    await page.reload();
    await expect(list.getByText("会被删除的待办")).toBeVisible();
    await page.getByRole("button", { name: "删除「会被删除的待办」" }).click();
    await expect(page.getByText("还没有待办")).toBeVisible();
  });
});

test.describe("access control", () => {
  test("signed-out visitors are sent to sign-in @smoke", async ({ page }) => {
    await page.goto("/examples/todos");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fexamples%2Ftodos/);
  });
});
