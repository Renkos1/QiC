/**
 * A rendered email ready to send; always include a plain-text alternative.
 *
 * 渲染完成、可直接发送的邮件；始终同时提供纯文本版本。
 */
export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Input of emails that ask the user to open a link.
 *
 * 需要用户点击链接完成操作的邮件的输入。
 */
export interface ActionEmailInput {
  /** Recipient display name; user-provided, so escaped in HTML. 收件人称呼，来自用户输入，HTML 中会转义。 */
  name: string;
  /** Absolute URL the user must open to complete the action. 用户需要打开的绝对链接。 */
  url: string;
}

const PRODUCT_NAME = "QiC";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes the five HTML-significant characters; use for every user value placed in HTML.
 *
 * 转义 HTML 中有特殊含义的五个字符；所有放进 HTML 的用户数据都要经过它。
 *
 * @param value - Untrusted text. 不可信文本。
 * @returns Text safe for HTML content and attributes. 可安全放入 HTML 内容和属性的文本。
 */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

interface ActionLayout {
  subject: string;
  greeting: string;
  body: string;
  action: string;
  footnote: string;
}

const renderAction = ({ name, url }: ActionEmailInput, layout: ActionLayout): RenderedEmail => {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const text = [
    `${name}，${layout.greeting}`,
    "",
    layout.body,
    url,
    "",
    layout.footnote,
    "",
    `— ${PRODUCT_NAME}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="zh-CN">
  <body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
    <p>${safeName}，${escapeHtml(layout.greeting)}</p>
    <p>${escapeHtml(layout.body)}</p>
    <p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(layout.action)}</a></p>
    <p style="font-size:12px;color:#666">如果按钮无法点击，请复制链接到浏览器打开：<br>${safeUrl}</p>
    <p style="font-size:12px;color:#666">${escapeHtml(layout.footnote)}</p>
    <p>— ${PRODUCT_NAME}</p>
  </body>
</html>
`;
  return { subject: layout.subject, text, html };
};

/**
 * Renders the email-verification message sent after sign-up (and on unverified sign-in).
 *
 * 渲染注册后（以及未验证用户尝试登录时）发送的邮箱验证邮件。
 *
 * @param input - Recipient name and verification link. 收件人称呼和验证链接。
 */
export const renderVerifyEmail = (input: ActionEmailInput): RenderedEmail =>
  renderAction(input, {
    subject: `验证你的 ${PRODUCT_NAME} 邮箱`,
    greeting: "欢迎注册！",
    body: "请点击下面的链接完成邮箱验证：",
    action: "验证邮箱",
    footnote: "如果这不是你本人的操作，请忽略这封邮件。",
  });

/**
 * Renders the password-reset message.
 *
 * 渲染重置密码邮件。
 *
 * @param input - Recipient name and reset link. 收件人称呼和重置链接。
 */
export const renderResetPassword = (input: ActionEmailInput): RenderedEmail =>
  renderAction(input, {
    subject: `重置你的 ${PRODUCT_NAME} 密码`,
    greeting: "我们收到了重置密码的请求。",
    body: "请点击下面的链接设置新密码（链接有效期有限）：",
    action: "重置密码",
    footnote: "如果你没有申请重置密码，请忽略这封邮件，你的密码不会被修改。",
  });

/**
 * Input of the todo-completed notification.
 *
 * 待办完成通知邮件的输入。
 */
export interface TodoCompletedEmailInput extends ActionEmailInput {
  /** User-provided todo title; escaped in HTML. 用户填写的待办标题，HTML 中会转义。 */
  title: string;
}

/**
 * Renders the notification sent when a todo is completed.
 *
 * 渲染待办完成时发送的通知邮件。标题放在正文中，由 renderAction 统一做 HTML 转义。
 *
 * @param input - Recipient, todo title and a link back to the list. 收件人、待办标题和返回列表的链接。
 */
export const renderTodoCompleted = ({ name, url, title }: TodoCompletedEmailInput): RenderedEmail =>
  renderAction(
    { name, url },
    {
      subject: `已完成：${title}`,
      greeting: "干得漂亮！",
      body: `你刚刚完成了「${title}」。查看剩下的待办：`,
      action: "打开待办列表",
      footnote: "这是一封自动发送的通知邮件。",
    },
  );
