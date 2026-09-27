import { expect } from "@playwright/test";

/** Mailpit's HTTP API (docker-compose.yml). Mailpit 的 HTTP API 地址。 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:18025";

interface MessageSummary {
  ID: string;
  Subject: string;
}

const searchMessages = async (to: string): Promise<MessageSummary[]> => {
  const query = encodeURIComponent(`to:"${to}"`);
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  if (!response.ok) throw new Error(`Mailpit search failed: HTTP ${response.status}`);
  return ((await response.json()) as { messages: MessageSummary[] }).messages;
};

/**
 * Waits for an email to `to` whose subject contains `subject` and returns the first
 * link in its text body. Each test uses a unique address, so no inbox cleanup is needed.
 *
 * 等待发往 `to`、主题包含 `subject` 的邮件，返回正文中的第一个链接。
 * 每个测试使用唯一地址，因此不需要清理收件箱。
 */
export const waitForEmailLink = async (to: string, subject: string): Promise<string> => {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        messageId = (await searchMessages(to)).find((m) => m.Subject.includes(subject))?.ID;
        return messageId;
      },
      { message: `email "${subject}" to ${to}`, timeout: 20_000 },
    )
    .toBeTruthy();

  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const { Text } = (await response.json()) as { Text: string };
  const link = Text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No link in email "${subject}" to ${to}`);
  return link;
};

/**
 * Resolves once an email to `to` with `subject` in its subject line has arrived.
 *
 * 等到发往 `to`、主题包含 `subject` 的邮件到达后 resolve。
 */
export const waitForEmail = async (to: string, subject: string) => {
  await expect
    .poll(async () => (await searchMessages(to)).some((m) => m.Subject.includes(subject)), {
      message: `email "${subject}" to ${to}`,
      timeout: 20_000,
    })
    .toBe(true);
};

/**
 * Unique per test run so parallel tests and repeated runs never share accounts.
 *
 * 生成本次运行唯一的邮箱，保证并行测试和重复运行不会共用账号。
 */
export const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
