import { createTransport } from "nodemailer";
import type { RenderedEmail } from "./templates.js";

/**
 * A rendered email plus its recipient.
 *
 * 渲染好的邮件及收件人。
 */
export interface MailMessage extends RenderedEmail {
  /** Recipient address. 收件人地址。 */
  to: string;
}

/**
 * Sends email. The worker depends on this interface so tests can use an in-memory fake.
 *
 * 发送邮件的接口。worker 只依赖这个接口，测试时可以替换为内存实现。
 */
export interface Mailer {
  /** Sends one message; rejects on SMTP errors so the job is retried. 发送一封邮件；SMTP 出错时 reject，使任务重试。 */
  send: (message: MailMessage) => Promise<void>;
  /** Checks that the SMTP server is reachable and accepts the credentials. 检查 SMTP 服务可达且凭据有效。 */
  verify: () => Promise<void>;
  /** Closes pooled connections on shutdown. 停机时关闭连接。 */
  close: () => void;
}

/**
 * Options of {@link createSmtpMailer}.
 *
 * {@link createSmtpMailer} 的选项。
 */
export interface SmtpMailerOptions {
  /**
   * e.g. `smtp://127.0.0.1:11025` (Mailpit) or `smtps://user:pass@smtp.example.com:465`.
   * Prefer an IP literal locally: nodemailer resolves hosts via DNS, not the hosts file.
   *
   * 例如 `smtp://127.0.0.1:11025`（开发环境 Mailpit）或 `smtps://user:pass@smtp.example.com:465`。
   * 本地请用 IP：nodemailer 通过 DNS 查询解析主机名，不读 hosts 文件。
   */
  url: string;
  /** RFC 5322 sender, e.g. "QiC <no-reply@example.com>". 发件人。 */
  from: string;
}

/**
 * Creates a {@link Mailer} backed by an SMTP server (Mailpit in development).
 *
 * 创建基于 SMTP 的 {@link Mailer}（开发环境为 Mailpit，生产为真实 SMTP 服务）。
 *
 * @param options - SMTP URL and sender. SMTP 地址和发件人。
 */
export const createSmtpMailer = ({ url, from }: SmtpMailerOptions): Mailer => {
  const transport = createTransport(url);
  return {
    send: async ({ to, subject, text, html }) => {
      await transport.sendMail({ from, to, subject, text, html });
    },
    verify: async () => {
      await transport.verify();
    },
    close: () => transport.close(),
  };
};
