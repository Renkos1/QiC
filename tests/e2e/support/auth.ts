import { expect, type Page } from "@playwright/test";
import { uniqueEmail, waitForEmailLink } from "./mailpit.js";

/**
 * Waits until the page is hydrated: submit buttons stay disabled until then, and text
 * typed earlier would be lost to a native form submission.
 *
 * 等待页面完成水合：水合前提交按钮保持禁用，此前输入的内容会因原生表单提交而丢失。
 *
 * @param page - Current page. 当前页面。
 * @param submit - Accessible name of the form's submit button. 表单提交按钮的可访问名称。
 */
export const waitForForm = async (page: Page, submit: string) => {
  await expect(page.getByRole("button", { name: submit, exact: true })).toBeEnabled();
};

/** Password of every e2e account. 所有 e2e 账号使用的密码。 */
export const PASSWORD = "e2e-password-123";

/**
 * Registers a fresh user through the UI and completes email verification via Mailpit.
 *
 * 通过界面注册新用户，并经 Mailpit 打开验证链接完成邮箱验证；返回时已登录。
 */
export const signUpAndVerify = async (page: Page, label: string) => {
  const email = uniqueEmail(label);
  await page.goto("/sign-up");
  await waitForForm(page, "注册");
  await page.getByLabel("昵称").fill(`E2E ${label}`);
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(PASSWORD);
  await page.getByLabel("确认密码").fill(PASSWORD);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByText(`验证邮件已发送到 ${email}`)).toBeVisible();

  await page.goto(await waitForEmailLink(email, "验证"));
  await expect(page.getByText("邮箱验证成功")).toBeVisible();
  return email;
};
