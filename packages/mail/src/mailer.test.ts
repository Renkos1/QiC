/*
 * createSmtpMailer with nodemailer's transport faked: checks what is handed to SMTP,
 * not the network. Real delivery is covered by e2e through Mailpit.
 *
 * SMTP 发信器测试：替换 nodemailer 的 transport，只检查交给 SMTP 的内容，不走网络。
 * 真实投递由 e2e 经 Mailpit 覆盖。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSmtpMailer } from "./mailer.js";

const transport = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({})),
  verify: vi.fn(async () => true),
  close: vi.fn(),
}));
const createTransport = vi.hoisted(() => vi.fn(() => transport));
vi.mock("nodemailer", () => ({ createTransport }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSmtpMailer", () => {
  it("should send with the configured sender and both text and html parts", async () => {
    const mailer = createSmtpMailer({ url: "smtp://127.0.0.1:11025", from: "QiC <a@qic.local>" });
    await mailer.send({ to: "b@example.com", subject: "s", text: "t", html: "<p>h</p>" });
    expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:11025");
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: "QiC <a@qic.local>",
      to: "b@example.com",
      subject: "s",
      text: "t",
      html: "<p>h</p>",
    });
  });

  it("should reject when SMTP fails so the job can be retried", async () => {
    transport.sendMail.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const mailer = createSmtpMailer({ url: "smtp://127.0.0.1:11025", from: "a@qic.local" });
    await expect(
      mailer.send({ to: "b@example.com", subject: "s", text: "t", html: "h" }),
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("should expose verify and close for startup checks and shutdown", async () => {
    const mailer = createSmtpMailer({ url: "smtp://127.0.0.1:11025", from: "a@qic.local" });
    await mailer.verify();
    mailer.close();
    expect(transport.verify).toHaveBeenCalledOnce();
    expect(transport.close).toHaveBeenCalledOnce();
  });
});
