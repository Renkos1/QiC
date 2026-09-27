/*
 * Account flows through the real UI, api, worker and Mailpit: password reset, the
 * sign-in redirect back to the requested page, sign-out, and expired email links.
 *
 * 账号相关的端到端流程（真实的前端、api、worker 与 Mailpit）：重置密码、
 * 登录后回到原来请求的页面、退出登录，以及失效的邮件链接。
 */
import { expect, type Page, test } from "@playwright/test";
import { PASSWORD, signUpAndVerify, waitForForm } from "../support/auth.js";
import { waitForEmailLink } from "../support/mailpit.js";

const signIn = async (page: Page, email: string, password: string) => {
  await waitForForm(page, "登录");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录" }).click();
};

const signOut = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
};

test.describe("account", () => {
  test("user resets a forgotten password and signs in with the new one @smoke", async ({
    page,
  }) => {
    const email = await signUpAndVerify(page, "reset");
    await signOut(page);

    await page.getByRole("link", { name: "忘记密码？" }).click();
    // The sign-in page also has an email field; wait for the new page to be interactive.
    await waitForForm(page, "发送重置邮件");
    await page.getByLabel("邮箱").fill(email);
    await page.getByRole("button", { name: "发送重置邮件" }).click();
    await expect(page.getByText(/如果该邮箱已注册/)).toBeVisible();

    await page.goto(await waitForEmailLink(email, "重置"));
    await waitForForm(page, "重置密码");
    await page.getByLabel("新密码", { exact: true }).fill("new-e2e-password-456");
    await page.getByLabel("确认新密码").fill("new-e2e-password-456");
    await page.getByRole("button", { name: "重置密码" }).click();
    await expect(page.getByText(/密码已重置/)).toBeVisible();

    await page.getByRole("link", { name: "使用新密码登录" }).click();
    await signIn(page, email, PASSWORD);
    await expect(page.getByText("邮箱或密码错误")).toBeVisible();
    await signIn(page, email, "new-e2e-password-456");
    await expect(page).toHaveURL(/\/$/);
  });

  test("signing in returns the user to the page they asked for", async ({ page }) => {
    const email = await signUpAndVerify(page, "redirect");
    await signOut(page);

    await page.goto("/examples/todos");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fexamples%2Ftodos/);
    await signIn(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/examples\/todos$/);
  });

  test("an invalid verification link explains what to do next", async ({ page }) => {
    await page.goto("/verify-email?error=INVALID_TOKEN");
    await expect(page.getByText(/验证链接无效或已过期/)).toBeVisible();
  });
});
